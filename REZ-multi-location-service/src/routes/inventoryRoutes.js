import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LocationInventory, Location, Transfer } from '../index.js';

const router = Router();

/**
 * POST /api/inventory
 * Add inventory to a location
 */
router.post('/', async (req, res, next) => {
  try {
    const { locationId, productId, productName, quantity, minQuantity, maxQuantity, reorderPoint, reorderQuantity, unit } = req.body;

    if (!locationId || !productId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'locationId and productId are required'
      });
    }

    // Verify location exists
    const location = await Location.findOne({ locationId });
    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Location not found: ${locationId}`
      });
    }

    // Check if inventory already exists
    const existing = await LocationInventory.findOne({ locationId, productId });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Inventory already exists for this product at this location. Use PUT to update.'
      });
    }

    const inventoryId = `INV-${uuidv4().substring(0, 8).toUpperCase()}`;

    const inventory = new LocationInventory({
      inventoryId,
      locationId,
      productId,
      franchiseId: location.franchiseId,
      productName,
      quantity: quantity || 0,
      minQuantity: minQuantity || 0,
      maxQuantity,
      reorderPoint,
      reorderQuantity,
      unit: unit || 'units',
      status: 'in_stock',
      lastRestocked: quantity > 0 ? new Date() : null
    });

    // Update status based on quantity
    if (inventory.quantity === 0) {
      inventory.status = 'out_of_stock';
    } else if (inventory.minQuantity && inventory.quantity <= inventory.minQuantity) {
      inventory.status = 'low_stock';
    }

    inventory.movementHistory.push({
      type: 'restock',
      quantity: quantity || 0,
      previousQuantity: 0,
      newQuantity: inventory.quantity,
      notes: 'Initial inventory setup',
      timestamp: new Date()
    });

    await inventory.save();

    res.status(201).json({
      success: true,
      data: inventory
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/inventory
 * List inventory across locations
 */
router.get('/', async (req, res, next) => {
  try {
    const { locationId, franchiseId, status, productId, page = 1, limit = 20 } = req.query;

    const query = {};
    if (locationId) query.locationId = locationId;
    if (franchiseId) query.franchiseId = franchiseId;
    if (status) query.status = status;
    if (productId) query.productId = productId;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [inventory, total] = await Promise.all([
      LocationInventory.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      LocationInventory.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        inventory,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/inventory/:inventoryId
 * Get inventory details
 */
router.get('/:inventoryId', async (req, res, next) => {
  try {
    const { inventoryId } = req.params;

    const inventory = await LocationInventory.findOne({ inventoryId });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Inventory not found: ${inventoryId}`
      });
    }

    res.json({
      success: true,
      data: inventory
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/inventory/:inventoryId
 * Update inventory
 */
router.patch('/:inventoryId', async (req, res, next) => {
  try {
    const { inventoryId } = req.params;
    const { quantity, minQuantity, maxQuantity, reorderPoint, reorderQuantity } = req.body;

    const inventory = await LocationInventory.findOne({ inventoryId });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Inventory not found: ${inventoryId}`
      });
    }

    if (quantity !== undefined) {
      const previousQuantity = inventory.quantity;
      const change = quantity - previousQuantity;

      inventory.quantity = quantity;

      // Update status
      if (inventory.quantity === 0) {
        inventory.status = 'out_of_stock';
      } else if (inventory.minQuantity && inventory.quantity <= inventory.minQuantity) {
        inventory.status = 'low_stock';
      } else {
        inventory.status = 'in_stock';
      }

      inventory.movementHistory.push({
        type: 'adjustment',
        quantity: change,
        previousQuantity,
        newQuantity: quantity,
        notes: 'Manual adjustment',
        timestamp: new Date()
      });

      if (change > 0) {
        inventory.lastRestocked = new Date();
      }
    }

    if (minQuantity !== undefined) inventory.minQuantity = minQuantity;
    if (maxQuantity !== undefined) inventory.maxQuantity = maxQuantity;
    if (reorderPoint !== undefined) inventory.reorderPoint = reorderPoint;
    if (reorderQuantity !== undefined) inventory.reorderQuantity = reorderQuantity;

    inventory.updatedAt = new Date();
    await inventory.save();

    res.json({
      success: true,
      data: inventory
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inventory/:inventoryId/sale
 * Record a sale (decrease inventory)
 */
router.post('/:inventoryId/sale', async (req, res, next) => {
  try {
    const { inventoryId } = req.params;
    const { quantity, reference, notes } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Valid quantity is required'
      });
    }

    const inventory = await LocationInventory.findOne({ inventoryId });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Inventory not found: ${inventoryId}`
      });
    }

    if (inventory.quantity < quantity) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Insufficient quantity. Available: ${inventory.quantity}`
      });
    }

    const previousQuantity = inventory.quantity;
    inventory.quantity -= quantity;

    // Update status
    if (inventory.quantity === 0) {
      inventory.status = 'out_of_stock';
    } else if (inventory.minQuantity && inventory.quantity <= inventory.minQuantity) {
      inventory.status = 'low_stock';
    }

    inventory.lastSold = new Date();

    inventory.movementHistory.push({
      type: 'sale',
      quantity: -quantity,
      previousQuantity,
      newQuantity: inventory.quantity,
      reference,
      notes,
      timestamp: new Date()
    });

    inventory.updatedAt = new Date();
    await inventory.save();

    res.json({
      success: true,
      data: {
        inventoryId: inventory.inventoryId,
        soldQuantity: quantity,
        remainingQuantity: inventory.quantity,
        status: inventory.status
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inventory/:inventoryId/restock
 * Restock inventory
 */
router.post('/:inventoryId/restock', async (req, res, next) => {
  try {
    const { inventoryId } = req.params;
    const { quantity, notes } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Valid quantity is required'
      });
    }

    const inventory = await LocationInventory.findOne({ inventoryId });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Inventory not found: ${inventoryId}`
      });
    }

    const previousQuantity = inventory.quantity;
    inventory.quantity += quantity;

    // Update status
    if (inventory.quantity >= (inventory.minQuantity || 0)) {
      inventory.status = 'in_stock';
    }

    inventory.lastRestocked = new Date();

    inventory.movementHistory.push({
      type: 'restock',
      quantity,
      previousQuantity,
      newQuantity: inventory.quantity,
      notes: notes || 'Inventory restocked',
      timestamp: new Date()
    });

    inventory.updatedAt = new Date();
    await inventory.save();

    res.json({
      success: true,
      data: {
        inventoryId: inventory.inventoryId,
        addedQuantity: quantity,
        newQuantity: inventory.quantity,
        status: inventory.status
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/inventory/low-stock
 * Get all low stock items
 */
router.get('/reports/low-stock', async (req, res, next) => {
  try {
    const { franchiseId, locationId } = req.query;

    const query = {
      $or: [
        { status: 'low_stock' },
        { status: 'out_of_stock' },
        { $expr: { $lte: ['$quantity', '$minQuantity'] } }
      ]
    };

    if (franchiseId) query.franchiseId = franchiseId;
    if (locationId) query.locationId = locationId;

    const lowStockItems = await LocationInventory.find(query)
      .sort({ quantity: 1 })
      .limit(100);

    // Group by location
    const groupedByLocation = lowStockItems.reduce((acc, item) => {
      if (!acc[item.locationId]) {
        acc[item.locationId] = [];
      }
      acc[item.locationId].push(item);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        items: lowStockItems,
        groupedByLocation,
        totalCount: lowStockItems.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inventory/transfer
 * Create inventory transfer between locations
 */
router.post('/transfer', async (req, res, next) => {
  try {
    const { fromLocationId, toLocationId, items, initiatedBy, notes, expectedDelivery } = req.body;

    if (!fromLocationId || !toLocationId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'fromLocationId, toLocationId, and items are required'
      });
    }

    if (fromLocationId === toLocationId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Source and destination locations must be different'
      });
    }

    // Verify locations exist
    const [fromLocation, toLocation] = await Promise.all([
      Location.findOne({ locationId: fromLocationId }),
      Location.findOne({ locationId: toLocationId })
    ]);

    if (!fromLocation || !toLocation) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'One or both locations not found'
      });
    }

    // Verify franchise matches
    if (fromLocation.franchiseId !== toLocation.franchiseId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Cannot transfer between different franchises'
      });
    }

    // Verify inventory availability
    for (const item of items) {
      const inventory = await LocationInventory.findOne({
        locationId: fromLocationId,
        productId: item.productId
      });

      if (!inventory || inventory.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `Insufficient quantity for product ${item.productId}. Available: ${inventory?.quantity || 0}`
        });
      }
    }

    const transferId = `TRF-${uuidv4().substring(0, 8).toUpperCase()}`;

    const transfer = new Transfer({
      transferId,
      fromLocationId,
      toLocationId,
      franchiseId: fromLocation.franchiseId,
      items,
      status: 'pending',
      initiatedBy,
      notes,
      expectedDelivery
    });

    await transfer.save();

    res.status(201).json({
      success: true,
      data: transfer
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/inventory/transfer/:transferId
 * Update transfer status
 */
router.patch('/transfer/:transferId', async (req, res, next) => {
  try {
    const { transferId } = req.params;
    const { status, approvedBy, notes } = req.body;

    const transfer = await Transfer.findOne({ transferId });

    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Transfer not found: ${transferId}`
      });
    }

    const validTransitions = {
      pending: ['approved', 'cancelled'],
      approved: ['in_transit', 'cancelled'],
      in_transit: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    };

    if (!validTransitions[transfer.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Cannot transition from ${transfer.status} to ${status}`
      });
    }

    transfer.status = status;

    if (status === 'approved') {
      transfer.approvedBy = approvedBy;
    }

    if (status === 'delivered') {
      transfer.actualDelivery = new Date();

      // Update inventory at both locations
      for (const item of transfer.items) {
        // Decrease from source
        await LocationInventory.updateOne(
          { locationId: transfer.fromLocationId, productId: item.productId },
          {
            $inc: { quantity: -item.quantity },
            $push: {
              movementHistory: {
                type: 'transfer',
                quantity: -item.quantity,
                reference: transferId,
                notes: `Transferred to ${transfer.toLocationId}`,
                timestamp: new Date()
              }
            }
          }
        );

        // Increase at destination
        const destInventory = await LocationInventory.findOne({
          locationId: transfer.toLocationId,
          productId: item.productId
        });

        if (destInventory) {
          await LocationInventory.updateOne(
            { locationId: transfer.toLocationId, productId: item.productId },
            {
              $inc: { quantity: item.quantity },
              $push: {
                movementHistory: {
                  type: 'transfer',
                  quantity: item.quantity,
                  reference: transferId,
                  notes: `Transferred from ${transfer.fromLocationId}`,
                  timestamp: new Date()
                }
              }
            }
          );
        } else {
          // Create new inventory record
          const newInventory = new LocationInventory({
            inventoryId: `INV-${uuidv4().substring(0, 8).toUpperCase()}`,
            locationId: transfer.toLocationId,
            productId: item.productId,
            productName: item.productName,
            franchiseId: transfer.franchiseId,
            quantity: item.quantity,
            lastRestocked: new Date()
          });
          await newInventory.save();
        }
      }
    }

    if (notes) transfer.notes = notes;
    transfer.updatedAt = new Date();
    await transfer.save();

    res.json({
      success: true,
      data: transfer
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/inventory/transfer/:transferId
 * Get transfer details
 */
router.get('/transfer/:transferId', async (req, res, next) => {
  try {
    const { transferId } = req.params;

    const transfer = await Transfer.findOne({ transferId });

    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Transfer not found: ${transferId}`
      });
    }

    res.json({
      success: true,
      data: transfer
    });
  } catch (error) {
    next(error);
  }
});

export default router;
