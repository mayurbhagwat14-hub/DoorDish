import { FoodZone } from '../../admin/models/zone.model.js';
import { isPointInZonePolygon, distToPolygonKm } from '../../utils/zoneGeo.js';

const toFinite = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
};

const DEFAULT_ZONE_BUFFER_KM = 10;

/** GET /zones/detect?lat=..&lng=.. */
export const detectZonePublicController = async (req, res, next) => {
    try {
        const lat = toFinite(req.query.lat);
        const lng = toFinite(req.query.lng);
        if (lat === null || lng === null) {
            return res.status(400).json({ success: false, message: 'lat and lng are required' });
        }

        const zones = await FoodZone.find({ isActive: true }).lean();

        // Pass 1: Exact polygon containment (zero buffer)
        for (const zone of zones) {
            const coords = Array.isArray(zone.coordinates) ? zone.coordinates : [];
            if (coords.length < 3) continue;
            if (isPointInZonePolygon(lat, lng, coords, 0)) {
                return res.status(200).json({
                    success: true,
                    message: 'Zone detected',
                    data: { status: 'IN_SERVICE', zoneId: zone._id, zone }
                });
            }
        }

        // Pass 2: Proximity boundary buffer tolerance (covers surrounding areas & boundary drift)
        let closestZone = null;
        let minDistance = Infinity;
        for (const zone of zones) {
            const coords = Array.isArray(zone.coordinates) ? zone.coordinates : [];
            if (coords.length < 3) continue;
            const dist = distToPolygonKm(lat, lng, coords);
            if (dist <= DEFAULT_ZONE_BUFFER_KM && dist < minDistance) {
                minDistance = dist;
                closestZone = zone;
            }
        }

        if (closestZone) {
            return res.status(200).json({
                success: true,
                message: 'Zone detected (service coverage area)',
                data: { status: 'IN_SERVICE', zoneId: closestZone._id, zone: closestZone }
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Out of service',
            data: { status: 'OUT_OF_SERVICE', zoneId: null, zone: null }
        });
    } catch (error) {
        next(error);
    }
};

/** GET /zones/public - list active zones for onboarding/selects */
export const listZonesPublicController = async (_req, res, next) => {
    try {
        const zones = await FoodZone.find({ isActive: true })
            .select('name zoneName serviceLocation country unit isActive coordinates createdAt')
            .sort({ createdAt: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: 'Zones fetched successfully',
            data: { zones }
        });
    } catch (error) {
        next(error);
    }
};

/** GET /zones/nearby - list zones for hotspot/nearby visualization */
export const listZonesNearbyPublicController = async (req, res, next) => {
    try {
        const zones = await FoodZone.find({ isActive: true })
            .select('name zoneName serviceLocation country unit isActive coordinates createdAt')
            .sort({ createdAt: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: 'Nearby zones fetched',
            data: { zones }
        });
    } catch (error) {
        next(error);
    }
};

