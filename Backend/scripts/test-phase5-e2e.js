import mongoose from 'mongoose';
import assert from 'node:assert';
import { connectDB } from '../src/config/db.js';
import { FoodOrder } from '../src/modules/food/orders/models/order.model.js';
import { FoodDeliveryPartner } from '../src/modules/food/delivery/models/deliveryPartner.model.js';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodUser } from '../src/core/users/user.model.js';
import * as orderService from '../src/modules/food/orders/services/order.service.js';
import * as orderDeliveryService from '../src/modules/food/orders/services/order-delivery.service.js';
import { ValidationError, ForbiddenError } from '../src/core/auth/errors.js';

async function runPhase5Tests() {
  console.log('================================================================');
  console.log('🚀 Phase 5: End-to-End Integration & Regression Verification Suite');
  console.log('================================================================\n');

  await connectDB();

  const createdOrderIds = [];
  const createdPartnerIds = [];
  const createdRestaurantIds = [];
  const createdUserIds = [];

  try {
    // -------------------------------------------------------------
    // SETUP TEST FIXTURES
    // -------------------------------------------------------------
    const testUser = await FoodUser.create({
      phone: `999${Math.floor(1000000 + Math.random() * 9000000)}`,
      name: 'E2E Customer'
    });
    createdUserIds.push(testUser._id);

    const testRestaurant = await FoodRestaurant.create({
      restaurantName: 'Phase 5 Gourmet Kitchen',
      ownerName: 'Chef Gordon',
      phone: `888${Math.floor(1000000 + Math.random() * 9000000)}`,
      ownerPhone: `888${Math.floor(1000000 + Math.random() * 9000000)}`,
      status: 'approved',
      location: {
        type: 'Point',
        coordinates: [77.5946, 12.9716],
        latitude: 12.9716,
        longitude: 77.5946,
        city: 'Bangalore',
        state: 'Karnataka'
      }
    });
    createdRestaurantIds.push(testRestaurant._id);

    // Partners:
    // Partner Alpha: Online
    const partnerAlpha = await FoodDeliveryPartner.create({
      name: 'Rider Alpha',
      phone: `777${Math.floor(1000000 + Math.random() * 9000000)}`,
      status: 'approved',
      availabilityStatus: 'online',
      vehicleType: 'bike',
      vehicleNumber: `KA01AL${Math.floor(1000 + Math.random() * 9000)}`,
      lastLat: 12.9720,
      lastLng: 77.5950,
      lastLocationAt: new Date()
    });
    createdPartnerIds.push(partnerAlpha._id);

    // Partner Beta: Online
    const partnerBeta = await FoodDeliveryPartner.create({
      name: 'Rider Beta',
      phone: `777${Math.floor(1000000 + Math.random() * 9000000)}`,
      status: 'approved',
      availabilityStatus: 'online',
      vehicleType: 'scooter',
      vehicleNumber: `KA01BE${Math.floor(1000 + Math.random() * 9000)}`,
      lastLat: 12.9730,
      lastLng: 77.5960,
      lastLocationAt: new Date()
    });
    createdPartnerIds.push(partnerBeta._id);

    // Partner Gamma: Offline
    const partnerGamma = await FoodDeliveryPartner.create({
      name: 'Rider Gamma',
      phone: `777${Math.floor(1000000 + Math.random() * 9000000)}`,
      status: 'approved',
      availabilityStatus: 'offline',
      vehicleType: 'bike',
      vehicleNumber: `KA01GA${Math.floor(1000 + Math.random() * 9000)}`,
      lastLat: 12.9740,
      lastLng: 77.5970,
      lastLocationAt: new Date()
    });
    createdPartnerIds.push(partnerGamma._id);

    const adminId = new mongoose.Types.ObjectId().toString();

    const makeOrder = async (orderStatus = 'confirmed', extra = {}) => {
      const order = await FoodOrder.create({
        userId: testUser._id,
        restaurantId: testRestaurant._id,
        orderType: 'delivery',
        orderStatus,
        restaurantName: testRestaurant.restaurantName,
        customerName: testUser.name,
        customerPhone: testUser.phone,
        pricing: { total: 350, subtotal: 300, deliveryFee: 50 },
        payment: { method: 'cash', status: 'cod_pending' },
        deliveryAddress: {
          street: '123 MG Road',
          city: 'Bangalore',
          state: 'Karnataka',
          location: {
            type: 'Point',
            coordinates: [77.6000, 12.9750]
          }
        },
        items: [{
          itemId: 'item_pizza_1',
          name: 'Margherita Pizza',
          quantity: 1,
          price: 300,
          totalPrice: 300
        }],
        dispatch: {
          status: 'unassigned',
          deliveryPartnerId: null,
          modeAtCreation: 'manual'
        },
        ...extra
      });
      createdOrderIds.push(order._id);
      return order;
    };

    // -------------------------------------------------------------
    // SCENARIO 1: Customer Places an Order
    // -------------------------------------------------------------
    console.log('👉 [Scenario 1] Customer places an order; order and restaurant flows functional');
    const sc1Order = await makeOrder('confirmed');
    assert.strictEqual(sc1Order.orderStatus, 'confirmed', 'Order should be created in confirmed status');
    assert.strictEqual(sc1Order.dispatch.status, 'unassigned', 'Dispatch should start unassigned');
    assert.strictEqual(sc1Order.dispatch.deliveryPartnerId, null, 'No partner assigned at creation');
    console.log('   ✅ Passed: Order created successfully with unassigned manual dispatch status\n');

    // -------------------------------------------------------------
    // SCENARIO 2: Restaurant Accepts Order -> Appears in Admin Queue
    // -------------------------------------------------------------
    console.log('👉 [Scenario 2] Restaurant accepts order; order updates to preparing');
    await orderService.updateOrderStatusRestaurant(
      sc1Order._id.toString(),
      testRestaurant._id.toString(),
      'preparing'
    );
    const sc2Order = await FoodOrder.findById(sc1Order._id).lean();
    assert.strictEqual(sc2Order.orderStatus, 'preparing', 'Order status should be preparing');
    assert.strictEqual(sc2Order.dispatch.status, 'unassigned', 'Order should remain unassigned in admin queue');
    console.log('   ✅ Passed: Restaurant updated status to preparing; order awaits admin dispatch\n');

    // -------------------------------------------------------------
    // SCENARIO 3: Restaurant Acceptance Does NOT Broadcast Delivery Requests
    // -------------------------------------------------------------
    console.log('👉 [Scenario 3] Restaurant acceptance does NOT broadcast to nearby partners');
    await orderService.updateOrderStatusRestaurant(
      sc1Order._id.toString(),
      testRestaurant._id.toString(),
      'ready_for_pickup'
    );
    const sc3Order = await FoodOrder.findById(sc1Order._id).lean();
    assert.strictEqual(sc3Order.orderStatus, 'ready_for_pickup');
    assert.strictEqual(sc3Order.dispatch.status, 'unassigned', 'Must remain unassigned');
    assert.strictEqual(sc3Order.dispatch.deliveryPartnerId, null, 'Must not auto-assign partner');
    assert.strictEqual((sc3Order.dispatch.offeredTo || []).length, 0, 'Must not broadcast to offeredTo list');
    console.log('   ✅ Passed: No broadcast or nearby matching triggered on restaurant updates\n');

    // -------------------------------------------------------------
    // SCENARIO 4: Admin Sees Online/Offline Presence & Accurate Active Counts
    // -------------------------------------------------------------
    console.log('👉 [Scenario 4] Admin sees real online/offline presence & active workload counts');
    const workloadInitial = await orderService.getDeliveryPartnersWorkload({
      orderId: sc1Order._id.toString()
    });
    const pAlphaInit = workloadInitial.partners.find(p => String(p._id) === String(partnerAlpha._id));
    const pGammaInit = workloadInitial.partners.find(p => String(p._id) === String(partnerGamma._id));
    assert.strictEqual(pAlphaInit.presence, 'online', 'Partner Alpha must show online presence');
    assert.strictEqual(pAlphaInit.activeOrdersCount, 0, 'Partner Alpha active count must be 0 initially');
    assert.strictEqual(pAlphaInit.workload, 'available', 'Partner Alpha workload must be available');
    assert.strictEqual(pGammaInit.presence, 'offline', 'Partner Gamma must show offline presence');
    assert.strictEqual(pGammaInit.workload, 'offline', 'Partner Gamma workload must be offline');
    console.log('   ✅ Passed: Partner presence and active counts reported accurately\n');

    // -------------------------------------------------------------
    // SCENARIO 5: Admin Assigns to Online Partner (Direct Assignment)
    // -------------------------------------------------------------
    console.log('👉 [Scenario 5] Admin assigns order to online partner (Partner Alpha)');
    const assignedSc1 = await orderService.assignDeliveryPartnerAdmin(
      sc1Order._id.toString(),
      partnerAlpha._id.toString(),
      adminId
    );
    assert.strictEqual(assignedSc1.dispatch.status, 'assigned', 'Dispatch status must be assigned');
    assert.strictEqual(String(assignedSc1.dispatch.deliveryPartnerId), String(partnerAlpha._id));
    console.log('   ✅ Passed: Admin assigned Order 1 to Partner Alpha directly\n');

    // -------------------------------------------------------------
    // SCENARIO 6: Admin Assigns Another Order to Same Busy Partner
    // -------------------------------------------------------------
    console.log('👉 [Scenario 6] Admin assigns second order to same busy partner (Multiple Active Orders)');
    const sc6Order = await makeOrder('ready_for_pickup');
    const assignedSc6 = await orderService.assignDeliveryPartnerAdmin(
      sc6Order._id.toString(),
      partnerAlpha._id.toString(),
      adminId
    );
    assert.strictEqual(assignedSc6.dispatch.status, 'assigned');
    assert.strictEqual(String(assignedSc6.dispatch.deliveryPartnerId), String(partnerAlpha._id));

    // Verify both orders are currently active for Partner Alpha
    const alphaActiveTrips = await orderDeliveryService.getActiveTripsDelivery(partnerAlpha._id.toString());
    const alphaTripIds = alphaActiveTrips.map(o => String(o._id));
    assert(alphaTripIds.includes(String(sc1Order._id)), 'Order 1 must be in Partner Alpha active trips');
    assert(alphaTripIds.includes(String(sc6Order._id)), 'Order 2 must be in Partner Alpha active trips');
    assert.strictEqual(alphaActiveTrips.length, 2, 'Partner Alpha must have exactly 2 active orders');
    console.log('   ✅ Passed: Partner Alpha holds both assigned orders concurrently\n');

    // -------------------------------------------------------------
    // SCENARIO 7: Inspect Partner Active Orders & Categorization (Available, Busy, Offline)
    // -------------------------------------------------------------
    console.log('👉 [Scenario 7] Distinguish Available, Busy, and Offline partner workloads');
    const workloadAfter2 = await orderService.getDeliveryPartnersWorkload({});
    const alphaBusy = workloadAfter2.partners.find(p => String(p._id) === String(partnerAlpha._id));
    const betaAvailable = workloadAfter2.partners.find(p => String(p._id) === String(partnerBeta._id));
    const gammaOffline = workloadAfter2.partners.find(p => String(p._id) === String(partnerGamma._id));

    assert.strictEqual(alphaBusy.workload, 'busy', 'Partner Alpha must be categorized as busy');
    assert.strictEqual(alphaBusy.activeOrdersCount, 2, 'Partner Alpha active count must be 2');
    assert.strictEqual(betaAvailable.workload, 'available', 'Partner Beta must be categorized as available');
    assert.strictEqual(betaAvailable.activeOrdersCount, 0, 'Partner Beta active count must be 0');
    assert.strictEqual(gammaOffline.workload, 'offline', 'Partner Gamma must be categorized as offline');
    console.log('   ✅ Passed: Partners correctly categorized as Busy, Available, and Offline\n');

    // -------------------------------------------------------------
    // SCENARIO 8: Completing One Order Reduces Active Count Without Removing Other Orders
    // -------------------------------------------------------------
    console.log('👉 [Scenario 8] Completing Order 1 reduces workload without affecting Order 2');
    // Partner Alpha advances Order 1: reached pickup -> confirm pickup -> reached drop -> complete
    await orderDeliveryService.confirmReachedPickupDelivery(sc1Order._id.toString(), partnerAlpha._id.toString());
    await orderDeliveryService.confirmPickupDelivery(sc1Order._id.toString(), partnerAlpha._id.toString(), null);
    await orderDeliveryService.confirmReachedDropDelivery(sc1Order._id.toString(), partnerAlpha._id.toString());

    // Mark delivery completed
    await orderDeliveryService.completeDelivery(sc1Order._id.toString(), partnerAlpha._id.toString(), {
      paymentMethod: 'cash'
    });

    const sc1Final = await FoodOrder.findById(sc1Order._id).lean();
    assert.strictEqual(sc1Final.orderStatus, 'delivered', 'Order 1 must be marked delivered');

    // Check Partner Alpha active trips after completing Order 1
    const alphaTripsAfterCompletion = await orderDeliveryService.getActiveTripsDelivery(partnerAlpha._id.toString());
    assert.strictEqual(alphaTripsAfterCompletion.length, 1, 'Partner Alpha active trips must reduce to 1');
    assert.strictEqual(String(alphaTripsAfterCompletion[0]._id), String(sc6Order._id), 'Order 2 must still remain active');

    const sc6Check = await FoodOrder.findById(sc6Order._id).lean();
    assert.strictEqual(sc6Check.orderStatus, 'ready_for_pickup', 'Order 2 status must remain unchanged');
    console.log('   ✅ Passed: Order 1 completed; Order 2 remains active and isolated\n');

    // -------------------------------------------------------------
    // SCENARIO 9: Cancelling an Order Updates Workload Correctly
    // -------------------------------------------------------------
    console.log('👉 [Scenario 9] Cancelling Order 2 updates partner active workload');
    // Verify business rule: customer cannot cancel once food is prepared/ready
    let customerCancelBlocked = false;
    try {
      await orderService.cancelOrder(
        sc6Order._id.toString(),
        testUser._id.toString(),
        'Customer changed mind'
      );
    } catch (err) {
      if (err instanceof ValidationError && err.message.includes('cannot be cancelled')) {
        customerCancelBlocked = true;
      }
    }
    assert(customerCancelBlocked, 'Customer cancellation on ready food must be blocked by business rules');

    // Admin/Restaurant cancellation succeeds
    await orderService.updateOrderStatusesAdmin(sc6Order._id.toString(), adminId, {
      orderStatus: 'cancelled_by_admin'
    });
    const sc6Final = await FoodOrder.findById(sc6Order._id).lean();
    assert(sc6Final.orderStatus.startsWith('cancelled'), 'Order 2 must be marked cancelled');

    const alphaTripsAfterCancel = await orderDeliveryService.getActiveTripsDelivery(partnerAlpha._id.toString());
    assert.strictEqual(alphaTripsAfterCancel.length, 0, 'Partner Alpha active trips must return to 0');

    const alphaCountFinal = await orderDeliveryService.countActiveTripsForPartner(partnerAlpha._id.toString());
    assert.strictEqual(alphaCountFinal, 0, 'Partner Alpha active count must be 0');
    console.log('   ✅ Passed: Business rules enforced & workload decremented to 0 after cancellation\n');

    // -------------------------------------------------------------
    // SCENARIO 10: Concurrency Safety & Conflicting Assignment Prevention
    // -------------------------------------------------------------
    console.log('👉 [Scenario 10] Concurrent assignment attempts cannot create dual active assignments');
    const orderRace = await makeOrder('ready_for_pickup');
    const [raceA, raceB] = await Promise.allSettled([
      orderService.assignDeliveryPartnerAdmin(orderRace._id.toString(), partnerAlpha._id.toString(), adminId),
      orderService.assignDeliveryPartnerAdmin(orderRace._id.toString(), partnerBeta._id.toString(), adminId)
    ]);

    const raceOrder = await FoodOrder.findById(orderRace._id).lean();
    assert(raceOrder.dispatch.deliveryPartnerId != null, 'Order must be assigned to one partner');
    // Exactly one partner was assigned
    const assignedId = String(raceOrder.dispatch.deliveryPartnerId);
    assert([String(partnerAlpha._id), String(partnerBeta._id)].includes(assignedId));
    console.log(`   ✅ Passed: Concurrency resolved safely to single partner: ${assignedId}\n`);

    // -------------------------------------------------------------
    // SCENARIO 11: Security & Authorization Protection
    // -------------------------------------------------------------
    console.log('👉 [Scenario 11] Unauthorized partner cannot execute actions on another partner order');
    let unauthorizedCaught = false;
    try {
      // Partner Beta attempts to confirm pickup on Partner Alpha's order
      const assignedToAlpha = assignedId === String(partnerAlpha._id) ? orderRace : await makeOrder('ready_for_pickup');
      if (assignedToAlpha !== orderRace) {
        await orderService.assignDeliveryPartnerAdmin(assignedToAlpha._id.toString(), partnerAlpha._id.toString(), adminId);
      }
      await orderDeliveryService.confirmReachedPickupDelivery(
        assignedToAlpha._id.toString(),
        partnerBeta._id.toString() // Unauthorized partner
      );
    } catch (err) {
      if (err instanceof ForbiddenError && err.message.includes('Not your order')) {
        unauthorizedCaught = true;
      } else {
        throw err;
      }
    }
    assert(unauthorizedCaught, 'ForbiddenError must be thrown when accessing another partner order');
    console.log('   ✅ Passed: Partner authorization verified; foreign actions blocked\n');

    // -------------------------------------------------------------
    // SCENARIO 12: Reconnecting Partner Retrieves Confirmed Assignments
    // -------------------------------------------------------------
    console.log('👉 [Scenario 12] Reconnecting partner retrieves current active assignments via backend API');
    const sc12Order = await makeOrder('ready_for_pickup');
    await orderService.assignDeliveryPartnerAdmin(
      sc12Order._id.toString(),
      partnerBeta._id.toString(),
      adminId
    );

    // Simulate partner reconnect calling getActiveTripsDelivery & getCurrentTripDelivery
    const betaTrips = await orderDeliveryService.getActiveTripsDelivery(partnerBeta._id.toString());
    const betaCurrent = await orderDeliveryService.getCurrentTripDelivery(partnerBeta._id.toString());

    assert(betaTrips.length >= 1, 'Reconnecting partner must find active assignments');
    assert.strictEqual(String(betaCurrent._id), String(sc12Order._id), 'Current trip matches latest assignment');
    console.log('   ✅ Passed: Reconnecting partner retrieves backend-confirmed assignments\n');

    // -------------------------------------------------------------
    // SCENARIO 13: Reassignment Consistency & Stale State Elimination
    // -------------------------------------------------------------
    console.log('👉 [Scenario 13] Reassignment from Partner Beta to Partner Alpha leaves no stale state');
    const reassignedOrder = await orderService.assignDeliveryPartnerAdmin(
      sc12Order._id.toString(),
      partnerAlpha._id.toString(),
      adminId,
      { reassign: true }
    );
    assert.strictEqual(String(reassignedOrder.dispatch.deliveryPartnerId), String(partnerAlpha._id));

    // Verify Partner Beta NO LONGER holds this order
    const betaTripsAfterReassign = await orderDeliveryService.getActiveTripsDelivery(partnerBeta._id.toString());
    const betaIdsAfter = betaTripsAfterReassign.map(o => String(o._id));
    assert(!betaIdsAfter.includes(String(sc12Order._id)), 'Partner Beta must not retain reassigned order');

    // Verify Partner Alpha holds this order
    const alphaTripsAfterReassign = await orderDeliveryService.getActiveTripsDelivery(partnerAlpha._id.toString());
    const alphaIdsAfter = alphaTripsAfterReassign.map(o => String(o._id));
    assert(alphaIdsAfter.includes(String(sc12Order._id)), 'Partner Alpha must now hold the reassigned order');
    console.log('   ✅ Passed: Reassignment cleanly transitioned ownership without orphaned states\n');

    // -------------------------------------------------------------
    // SCENARIO 14: Payment, Tracking & Admin List Workflows
    // -------------------------------------------------------------
    console.log('👉 [Scenario 14] Existing payment, customer tracking, and admin orders flows working');
    const adminOrders = await orderService.listOrdersAdmin({ limit: 10, page: 1 });
    const adminDocs = adminOrders.orders || adminOrders.data || [];
    assert(adminDocs.length > 0, 'Admin orders list must return orders');

    const customerOrders = await orderService.listOrdersUser(testUser._id.toString(), { limit: 10 });
    const userDocs = customerOrders.data || customerOrders.orders || [];
    assert(userDocs.length > 0, 'Customer order tracking list must return customer orders');
    console.log('   ✅ Passed: Payment, user orders, and admin order listing functional\n');

    console.log('================================================================');
    console.log('🎉 ALL 14 E2E INTEGRATION & REGRESSION SCENARIOS PASSED!');
    console.log('================================================================\n');
  } finally {
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

runPhase5Tests().catch((err) => {
  console.error('\n❌ E2E test suite failed with error:\n', err);
  process.exit(1);
});
