import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env.js';
import { ValidationError } from '../core/auth/errors.js';

// Configure Cloudinary SDK if credentials and toggle are active
if (config.useCloudinary && config.cloudinaryCloudName) {
    cloudinary.config({
        cloud_name: config.cloudinaryCloudName,
        api_key: config.cloudinaryApiKey,
        api_secret: config.cloudinaryApiSecret,
        secure: true
    });
}

const UPLOADS_ROOT = config.uploadsRoot;

const usesRemoteStore = () => {
    if (!config.uploadRemoteOrigin || config.nodeEnv === 'production') return false;
    const remote = String(config.uploadRemoteOrigin).toLowerCase();
    const selfPort = String(config.port || 5000);
    // Prevent infinite self-recursion if UPLOAD_REMOTE_ORIGIN points to our own server
    if (remote.includes(`localhost:${selfPort}`) || remote.includes(`127.0.0.1:${selfPort}`)) {
        return false;
    }
    return true;
};

const ensureRoot = async () => {
    await fs.promises.mkdir(UPLOADS_ROOT, { recursive: true });
};

/** 'food/restaurants/pan' -> 'food_restaurants_pan' */
export const flattenFolder = (folder) => {
    const cleaned = String(folder || 'uploads')
        .trim()
        .replace(/\\/g, '/')
        .replace(/\.{2,}/g, '')
        .replace(/^\/+|\/+$/g, '')
        .replace(/[^A-Za-z0-9/_-]/g, '')
        .replace(/\/+/g, '_');
    return cleaned || 'uploads';
};

const randomId = () => crypto.randomBytes(10).toString('hex');

export const buildAssetUrl = (filename) => `${config.assetBaseUrl}/uploads/${filename}`;

export const extractAssetUrl = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') {
        return String(value.url || value.secure_url || value.imageUrl || value.iconUrl || value.src || '').trim();
    }
    return '';
};

export const extractAssetUrls = (value) => {
    if (value == null || value === '') return [];
    if (Array.isArray(value)) {
        return [...new Set(value.flatMap(extractAssetUrls).filter(Boolean))];
    }
    const one = extractAssetUrl(value);
    return one ? [one] : [];
};

const encodeToWebp = async (buffer, { maxWidth } = {}) => {
    try {
        let pipeline = sharp(buffer, { animated: true, failOn: 'none' });
        if (maxWidth) {
            pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
        }
        const meta = await sharp(buffer, { failOn: 'none' }).metadata().catch(() => ({}));
        const out = await pipeline.webp({ quality: 90, effort: 4 }).toBuffer();
        if (!out?.length) {
            throw new Error('empty webp output');
        }
        return { buffer: out, ext: 'webp', width: meta.width, height: meta.height };
    } catch {
        throw new ValidationError('Could not convert image to WebP. Upload a valid image file.');
    }
};

export const resolveStoredFilename = async (urlOrPublicId) => {
    if (!urlOrPublicId) return null;

    let name = String(urlOrPublicId).trim();
    if (/^https?:\/\//i.test(name)) {
        try {
            name = decodeURIComponent(new URL(name).pathname);
        } catch {
            return null;
        }
        const marker = name.match(/\/(?:image|video|raw)\/upload\/(.+)$/i);
        if (marker) {
            name = marker[1]
                .split('/')
                .filter((p) => !/^v\d+$/.test(p))
                .join('_');
        }
    }
    name = name.replace(/\\/g, '/');
    if (name.includes('/')) {
        name = name.replace(/^\/?uploads\//i, '').replace(/\//g, '_');
    }
    name = path.basename(name);
    if (!name || name === '.' || name === '..') return null;
    if (path.extname(name)) return name;

    try {
        const entries = await fs.promises.readdir(UPLOADS_ROOT);
        return entries.find((f) => f.startsWith(`${name}.`)) || null;
    } catch {
        return null;
    }
};

const writeBufferToDisk = async (data, folder, ext) => {
    await ensureRoot();
    const base = `${flattenFolder(folder)}_${randomId()}`;
    const filename = `${base}.${ext}`;
    await fs.promises.writeFile(path.join(UPLOADS_ROOT, filename), data);
    return {
        secure_url: buildAssetUrl(filename),
        url: buildAssetUrl(filename),
        public_id: base,
        filename,
        format: ext,
        bytes: data.length
    };
};

const uploadToCloudinaryBuffer = async (buffer, folder = 'uploads', options = {}) => {
    return new Promise((resolve, reject) => {
        const resourceType = options.resourceType || 'auto';
        const uploadOptions = {
            folder: folder || 'uploads',
            resource_type: resourceType
        };
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (error) {
                return reject(new ValidationError(error.message || 'Cloudinary upload failed'));
            }
            resolve({
                secure_url: result.secure_url,
                url: result.secure_url || result.url,
                public_id: result.public_id,
                filename: result.public_id,
                format: result.format,
                bytes: result.bytes,
                width: result.width,
                height: result.height,
                resource_type: result.resource_type || 'image'
            });
        });
        stream.end(buffer);
    });
};

const extractCloudinaryPublicId = (urlOrPublicId) => {
    if (!urlOrPublicId) return null;
    const str = String(urlOrPublicId).trim();
    if (!str) return null;
    if (str.includes('cloudinary.com')) {
        const match = str.match(/\/(?:image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/i);
        if (match && match[1]) {
            return match[1].replace(/\.[^/.]+$/, '');
        }
    }
    if (!/^https?:\/\//i.test(str) && config.useCloudinary) {
        return str;
    }
    return null;
};

const deleteFromCloudinary = async (urlOrPublicId, resourceType = 'image') => {
    const publicId = extractCloudinaryPublicId(urlOrPublicId);
    if (!publicId) return false;
    try {
        const res = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        return res.result === 'ok' || res.result === 'not found';
    } catch (err) {
        console.error(`Failed to delete Cloudinary asset ${publicId}:`, err.message);
        return false;
    }
};

const remoteHeaders = () => ({
    'X-Upload-Secret': config.uploadInternalSecret
});

const postRemoteFile = async ({ buffer, folder, replaceUrl, originalName, mimeType }) => {
    const form = new FormData();
    form.append(
        'file',
        new Blob([buffer], { type: mimeType || 'application/octet-stream' }),
        originalName || 'upload.bin'
    );
    form.append('folder', folder || 'uploads');
    if (replaceUrl) form.append('replaceUrl', String(replaceUrl));

    const response = await fetch(`${config.uploadRemoteOrigin}/api/v1/uploads/internal`, {
        method: 'POST',
        headers: remoteHeaders(),
        body: form
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || !payload?.data?.url) {
        throw new ValidationError(payload?.error || payload?.message || 'Failed to upload image to server');
    }
    return payload.data;
};

const deleteRemoteAsset = async (url) => {
    const response = await fetch(`${config.uploadRemoteOrigin}/api/v1/uploads/internal`, {
        method: 'DELETE',
        headers: {
            ...remoteHeaders(),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
    });
    return response.ok;
};

export const deleteFromDisk = async (urlOrPublicId) => {
    const filename = await resolveStoredFilename(urlOrPublicId);
    if (!filename) return false;
    try {
        await fs.promises.unlink(path.join(UPLOADS_ROOT, filename));
        return true;
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error(`Failed to delete upload ${filename}:`, err.message);
        }
        return false;
    }
};

/**
 * Store an image.
 * If USE_CLOUDINARY=true in .env, stores to Cloudinary.
 * Otherwise stores as WebP in local uploads folder (`/uploads`).
 */
export const storeImageBuffer = async (buffer, folder = 'uploads', options = {}) => {
    if (!buffer || !buffer.length) {
        throw new ValidationError('File buffer is required');
    }

    if (config.useCloudinary) {
        const uploaded = await uploadToCloudinaryBuffer(buffer, folder, { ...options, resourceType: 'image' });
        if (options.replaceUrl) {
            await deleteStoredAsset(options.replaceUrl, { skipRemote: options.skipRemote });
        }
        return uploaded;
    }

    if (usesRemoteStore() && !options.skipRemote) {
        return postRemoteFile({
            buffer,
            folder,
            replaceUrl: extractAssetUrl(options.replaceUrl),
            originalName: options.originalName || 'upload.jpg',
            mimeType: options.mimeType || 'image/jpeg'
        });
    }

    const encoded = await encodeToWebp(buffer, options);
    const stored = await writeBufferToDisk(encoded.buffer, folder, 'webp');
    if (options.replaceUrl) {
        await deleteStoredAsset(options.replaceUrl, { skipRemote: options.skipRemote });
    }
    return {
        ...stored,
        width: encoded.width,
        height: encoded.height,
        resource_type: 'image'
    };
};

/** Store a video/raw buffer. Images should use storeImageBuffer. */
export const storeFileBuffer = async (buffer, folder = 'uploads', originalName = '', options = {}) => {
    if (!buffer || !buffer.length) {
        throw new ValidationError('File buffer is required');
    }

    if (config.useCloudinary) {
        const uploaded = await uploadToCloudinaryBuffer(buffer, folder, { ...options, resourceType: 'auto' });
        if (options.replaceUrl) {
            await deleteStoredAsset(options.replaceUrl, { skipRemote: options.skipRemote });
        }
        return uploaded;
    }

    if (usesRemoteStore() && !options.skipRemote) {
        return postRemoteFile({
            buffer,
            folder,
            replaceUrl: options.replaceUrl,
            originalName: originalName || 'upload.bin',
            mimeType: options.mimeType || 'application/octet-stream'
        });
    }

    const rawExt = path.extname(String(originalName || '')).replace(/[^.A-Za-z0-9]/g, '') || '.bin';
    const stored = await writeBufferToDisk(buffer, folder, rawExt.replace('.', ''));
    if (options.replaceUrl) {
        await deleteStoredAsset(options.replaceUrl, { skipRemote: options.skipRemote });
    }
    return stored;
};

export const deleteStoredAsset = async (urlOrPublicId, options = {}) => {
    const url = extractAssetUrl(urlOrPublicId);
    if (!url) return false;

    if (String(url).includes('cloudinary.com') || (config.useCloudinary && extractCloudinaryPublicId(url))) {
        return deleteFromCloudinary(url);
    }

    if (usesRemoteStore() && !options.skipRemote) {
        try {
            return await deleteRemoteAsset(url);
        } catch (err) {
            console.error('Failed to delete remote upload:', err.message);
            return false;
        }
    }
    return deleteFromDisk(url);
};

export const deleteStoredAssets = async (urls = []) => {
    const list = extractAssetUrls(urls);
    await Promise.all(list.map((url) => deleteStoredAsset(url)));
};

/** Delete previous files that are no longer referenced after a successful replace. */
export const deleteReplacedAssets = async (previous, next) => {
    const prev = new Set(extractAssetUrls(previous));
    const curr = new Set(extractAssetUrls(next));
    const removed = [...prev].filter((url) => !curr.has(url));
    if (!removed.length) return;
    await deleteStoredAssets(removed);
};

export const uploadImageBuffer = async (buffer, folder = 'uploads', options = {}) => {
    const result = await storeImageBuffer(buffer, folder, options);
    return result.url || result.secure_url;
};

export { UPLOADS_ROOT };
