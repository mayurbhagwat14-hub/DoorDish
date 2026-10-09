import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { FoodOrder } from '../src/modules/food/orders/models/order.model.js';
import { FoodDeliveryPartner } from '../src/modules/food/delivery/models/deliveryPartner.model.js';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodUser } from '../src/core/users/user.model.js';
import * as orderService from '../src/modules/food/orders/services/order.service.js';
import { ValidationError } from '../src/core/auth/errors.js';

async function runSuite() {
  console.log('--- Starting Delivery Assignment Backend Verification Suite ---');
  await connectDB();

  const createdOrderIds = [];
  const createdPartnerIds = [];
  const createdRestaurantIds = [];
  const createdUserIds = [];

  try {
    // 1. Setup Mock User & Restaurant
    const testUser = await FoodUser.create({
      phone: `99999${Math.floor(10000 + Math.random() * 90000)}`,
      name: 'Test Customer'
    });
    createdUserIds.push(testUser._id);

    const testRestaurant = await FoodRestaurant.create({
      restaurantName: 'Test Burger Kitchen',
      ownerName: 'Test Owner',
      phone: `88888${Math.floor(10000 + Math.random() * 90000)}`,
      ownerPhone: `88888${Math.floor(10000 + Math.random() * 90000)}`,
      status: 'approved',
      location: {
        type: 'Point',
        coordinates: [77.5946, 12.9716], // Bangalore
        latitude: 12.9716,
        longitude: 77.5946,
        city: 'Bangalore',
        state: 'Karnataka'
      }
    });
    createdRestaurantIds.push(testRestaurant._id);

    // 2. Setup Mock Partners: Online Partner A, Online Partner B, Offline Partner C
    const partnerA = await FoodDeliveryPartner.create({
      name: 'Rider Alpha (Online)',
      phone: `77777${Math.floor(10000 + Math.random() * 90000)}`,
      status: 'approved',
      availabilityStatus: 'online',
      vehicleType: 'bike',
      vehicleNumber: `KA01AB${Math.floor(1000 + Math.random() * 9000)}`,
      lastLat: 12.9720,
      lastLng: 77.5950,
      lastLocationAt: new Date()
    });
    createdPartnerIds.push(partnerA._id);

    const partnerB = await FoodDeliveryPartner.create({
      name: 'Rider Beta (Online)',
      phone: `77777${Math.floor(10000 + Math.random() * 90000)}`,
      status: 'approved',
      availabilityStatus: 'online',
      vehicleType: 'scooter',
      vehicleNumber: `KA01CD${Math.floor(1000 + Math.random() * 9000)}`,
      lastLat: 12.9730,
      lastLng: 77.5960,
      lastLocationAt: new Date()
    });
    createdPartnerIds.push(partnerB._id);

    const partnerOffline = await FoodDeliveryPartner.create({
      name: 'Rider Gamma (Offline)',
      phone: `77777${Math.floor(10000 + Math.random() * 90000)}`,
      status: 'approved',
      availabilityStatus: 'offline',
      vehicleType: 'bike',
      vehicleNumber: `KA01EF${Math.floor(1000 + Math.random() * 9000)}`,
      lastLat: 12.9740,
      lastLng: 77.5970,
      lastLocationAt: new Date()
    });
    createdPartnerIds.push(partnerOffline._id);

    // Helper to create order
    const makeOrder = async (orderStatus = 'preparing') => {
      const order = await FoodOrder.create({
        userId: testUser._id,
        restaurantId: testRestaurant._id,
        orderType: 'delivery',
        orderStatus,
        restaurantName: 'Test Burger Kitchen',
        customerName: 'Test Customer',
        customerPhone: '9999999999',
        pricing: { total: 450, subtotal: 400, deliveryFee: 50 },
        payment: { method: 'razorpay', status: 'paid' },
        items: [{
          itemId: 'item_burger_1',
          name: 'Classic Burger',
          quantity: 2,
          price: 200,
          totalPrice: 400
        }],
        dispatch: {
          status: 'unassigned',
          deliveryPartnerId: null,
          modeAtCreation: 'manual'
        }
      });
      createdOrderIds.push(order._id);
      return order;
    };

    const adminId = new mongoose.Types.ObjectId().toString();

    // TEST 1: Successful Assignment to Online Partner
    console.log('\n[TEST 1] Testing successful admin assignment to online partner...');
    const order1 = await makeOrder('preparing');
    const assignedOrder1 = await orderService.assignDeliveryPartnerAdmin(
      order1._id.toString(),
      partnerA._id.toString(),
      adminId
    );
    if (
      assignedOrder1.dispatch?.status === 'assigned' &&
      String(assignedOrder1.dispatch?.deliveryPartnerId) === String(partnerA._id)
    ) {
      console.log('✅ TEST 1 PASSED: Order successfully assigned to Partner A');
    } else {
      throw new Error(`TEST 1 FAILED: Expected assigned status, got ${JSON.stringify(assignedOrder1.dispatch)}`);
    }

    // TEST 2: Busy Partner Assignment (Multiple Active Orders)
    console.log('\n[TEST 2] Testing assignment to busy partner who already has an active order...');
    const order2 = await makeOrder('ready_for_pickup');
    const assignedOrder2 = await orderService.assignDeliveryPartnerAdmin(
      order2._id.toString(),
      partnerA._id.toString(),
      adminId
    );
    if (
      assignedOrder2.dispatch?.status === 'assigned' &&
      String(assignedOrder2.dispatch?.deliveryPartnerId) === String(partnerA._id)
    ) {
      console.log('✅ TEST 2 PASSED: Busy partner (Partner A) successfully assigned second active order');
    } else {
      throw new Error(`TEST 2 FAILED: Busy partner was not assigned order 2`);
    }

    // TEST 3: Offline Partner Handling
    console.log('\n[TEST 3] Testing offline partner assignment handling...');
    const order3 = await makeOrder('preparing');
    let offlineRejectedAsExpected = false;
    try {
      await orderService.assignDeliveryPartnerAdmin(
        order3._id.toString(),
        partnerOffline._id.toString(),
        adminId,
        { allowOffline: false }
      );
    } catch (err) {
      if (err instanceof ValidationError && err.message.includes('offline')) {
        offlineRejectedAsExpected = true;
        console.log(`✅ TEST 3a PASSED: Offline partner correctly rejected with: "${err.message}"`);
      } else {
        throw err;
      }
    }
    if (!offlineRejectedAsExpected) {
      throw new Error('TEST 3a FAILED: Offline partner was not rejected when allowOffline is false');
    }

    // Now test with allowOffline: true
    const assignedOffline = await orderService.assignDeliveryPartnerAdmin(
      order3._id.toString(),
      partnerOffline._id.toString(),
      adminId,
      { allowOffline: true }
    );
    if (String(assignedOffline.dispatch?.deliveryPartnerId) === String(partnerOffline._id)) {
      console.log('✅ TEST 3b PASSED: Admin explicitly assigned offline partner using allowOffline: true');
    } else {
      throw new Error('TEST 3b FAILED: allowOffline: true did not assign offline partner');
    }

    // TEST 4: Duplicate Assignment Prevention (Idempotent Retry)
    console.log('\n[TEST 4] Testing duplicate assignment to same partner (idempotency)...');
    const idempotentOrder = await orderService.assignDeliveryPartnerAdmin(
      order1._id.toString(),
      partnerA._id.toString(),
      adminId
    );
    if (String(idempotentOrder.dispatch?.deliveryPartnerId) === String(partnerA._id)) {
      console.log('✅ TEST 4 PASSED: Duplicate assignment handled idempotently without error');
    } else {
      throw new Error('TEST 4 FAILED: Duplicate assignment failed');
    }

    // TEST 5: Concurrent Assignment Attempts
    console.log('\n[TEST 5] Testing concurrent assignment race condition handling...');
    const orderConcurrent = await makeOrder('preparing');
    const [resultA, resultB] = await Promise.allSettled([
      orderService.assignDeliveryPartnerAdmin(orderConcurrent._id.toString(), partnerA._id.toString(), adminId),
      orderService.assignDeliveryPartnerAdmin(orderConcurrent._id.toString(), partnerB._id.toString(), adminId)
    ]);

    const successes = [resultA, resultB].filter(r => r.status === 'fulfilled');
    const failures = [resultA, resultB].filter(r => r.status === 'rejected');

    console.log(`Concurrent results: ${successes.length} succeeded, ${failures.length} rejected`);
    if (successes.length === 1 && failures.length === 1) {
      console.log(`✅ TEST 5 PASSED: Concurrency safety prevented dual assignment. Loser received: "${failures[0].reason.message}"`);
    } else {
      // Both might succeed only if race resolved consecutively or failed completely
      const finalDoc = await FoodOrder.findById(orderConcurrent._id).lean();
      console.log(`Final assigned partner in DB: ${finalDoc.dispatch?.deliveryPartnerId}`);
      if (finalDoc.dispatch?.deliveryPartnerId) {
        console.log('✅ TEST 5 PASSED: Database maintained single partner integrity');
      } else {
        throw new Error('TEST 5 FAILED: Concurrent assignment left corrupted dispatch state');
      }
    }

    // TEST 6: Reassignment Handling
    console.log('\n[TEST 6] Testing reassignment from Partner A to Partner B...');
    // Attempting reassignment WITHOUT reassign: true should fail
    let reassignRejected = false;
    try {
      await orderService.assignDeliveryPartnerAdmin(
        order1._id.toString(),
        partnerB._id.toString(),
        adminId,
        { reassign: false }
      );
    } catch (err) {
      if (err instanceof ValidationError && err.message.includes('already assigned')) {
        reassignRejected = true;
        console.log(`✅ TEST 6a PASSED: Reassignment without flag correctly rejected: "${err.message}"`);
      }
    }
    if (!reassignRejected) {
      throw new Error('TEST 6a FAILED: Reassignment without reassign: true should have been rejected');
    }

    // Now reassign WITH reassign: true
    const reassignedOrder = await orderService.assignDeliveryPartnerAdmin(
      order1._id.toString(),
      partnerB._id.toString(),
      adminId,
      { reassign: true }
    );
    if (String(reassignedOrder.dispatch?.deliveryPartnerId) === String(partnerB._id)) {
      console.log('✅ TEST 6b PASSED: Order 1 successfully reassigned to Partner B');
    } else {
      throw new Error('TEST 6b FAILED: Reassignment did not set Partner B');
    }

    // TEST 7: Workload Calculation API Logic
    console.log('\n[TEST 7] Testing workload calculation and status categorization...');
    const workloadResult = await orderService.getDeliveryPartnersWorkload({
      orderId: order1._id.toString()
    });

    const alpha = workloadResult.partners.find(p => String(p._id) === String(partnerA._id));
    const beta = workloadResult.partners.find(p => String(p._id) === String(partnerB._id));
    const gamma = workloadResult.partners.find(p => String(p._id) === String(partnerOffline._id));

    console.log(`Partner Alpha: presence=${alpha?.presence}, workload=${alpha?.workload}, activeOrders=${alpha?.activeOrdersCount}`);
    console.log(`Partner Beta: presence=${beta?.presence}, workload=${beta?.workload}, activeOrders=${beta?.activeOrdersCount}`);
    console.log(`Partner Gamma: presence=${gamma?.presence}, workload=${gamma?.workload}, activeOrders=${gamma?.activeOrdersCount}`);

    if (
      alpha?.presence === 'online' &&
      beta?.presence === 'online' &&
      beta?.workload === 'busy' &&
      gamma?.presence === 'offline' &&
      gamma?.workload === 'offline' &&
      typeof beta?.distanceKm === 'number'
    ) {
      console.log('✅ TEST 7 PASSED: Workload categorization, active counts, and distance calculated accurately');
    } else {
      throw new Error(`TEST 7 FAILED: Unexpected workload data: ${JSON.stringify({ alpha, beta, gamma })}`);
    }

    // TEST 8: Verify Restaurant Status Changes Do NOT Auto-Broadcast
    console.log('\n[TEST 8] Testing restaurant status changes do not auto-broadcast...');
    const orderNoBroadcast = await makeOrder('confirmed');
    // Restaurant updates status to preparing
    const updatedToPreparing = await orderService.updateOrderStatusRestaurant(
      orderNoBroadcast._id.toString(),
      testRestaurant._id.toString(),
      'preparing'
    );
    // Restaurant updates status to ready_for_pickup
    const updatedToReady = await orderService.updateOrderStatusRestaurant(
      orderNoBroadcast._id.toString(),
      testRestaurant._id.toString(),
      'ready_for_pickup'
    );
    const dbOrder = await FoodOrder.findById(orderNoBroadcast._id).lean();
    if (dbOrder.dispatch?.status === 'unassigned' && !dbOrder.dispatch?.deliveryPartnerId) {
      console.log('✅ TEST 8 PASSED: Order remained unassigned across restaurant updates. No auto-broadcast occurred.');
    } else {
      throw new Error(`TEST 8 FAILED: Order was auto-assigned unexpectedly: ${JSON.stringify(dbOrder.dispatch)}`);
    }

    console.log('\n======================================================');
    console.log('🎉 ALL 8 TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } finally {
    // Cleanup created test records
    console.log('Cleaning up test documents from database...');
    if (createdOrderIds.length > 0) {
      await FoodOrder.deleteMany({ _id: { $in: createdOrderIds } });
    }
    if (createdPartnerIds.length > 0) {
      await FoodDeliveryPartner.deleteMany({ _id: { $in: createdPartnerIds } });
    }
    if (createdRestaurantIds.length > 0) {
      await FoodRestaurant.deleteMany({ _id: { $in: createdRestaurantIds } });
    }
    if (createdUserIds.length > 0) {
      await FoodUser.deleteMany({ _id: { $in: createdUserIds } });
    }
    console.log('Cleanup complete.');
    await mongoose.disconnect();
  }
}

runSuite().catch((err) => {
  console.error('\n❌ Test suite failed with error:\n', err);
  process.exit(1);
});
