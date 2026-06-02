/**
 * REZ Society OS
 * Complete Property Management System for Residential Societies
 *
 * Features:
 * - Society management
 * - Wing/Block management
 * - Flat/Unit management
 * - Resident management
 * - Maintenance tracking
 * - Visitor management
 * - Committee management
 * - Billing & payments
 * - Amenity booking
 * - Security & access
 * - Complaints & feedback
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 4900;

app.use(express.json());
app.use(cors());
app.use(helmet());

// ============================================
// TYPES
// ============================================

interface Society {
  id: string;
  name: string;
  address: string;
  city: string;
  pincode: string;
  type: 'apartment' | 'villa' | 'rowhouse' | ' plotted';
  totalWings: number;
  totalFlats: number;
  amenities: string[];
  management: {
    type: 'association' | 'society' | 'cooperative';
    registrationNo?: string;
  };
  committees: string[];
  settings: {
    maintenanceDueDay: number;
    lateFeePercentage: number;
    visitorApprovalRequired: boolean;
    gateClosingTime: string;
    gateOpeningTime: string;
  };
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
}

interface Wing {
  id: string;
  societyId: string;
  name: string;
  code: string;
  floors: number;
  flatsPerFloor: number;
  totalFlats: number;
  liftAvailable: boolean;
  status: 'active' | 'inactive';
}

interface Flat {
  id: string;
  societyId: string;
  wingId: string;
  flatNumber: string;
  floor: number;
  type: '1BHK' | '2BHK' | '3BHK' | '4BHK' | 'Penthouse' | 'Villa' | 'Plot';
  carpetArea: number;
  builtUpArea: number;
  ownerId?: string;
  tenantId?: string;
  status: 'vacant' | 'owner_occupied' | 'tenant_occupied' | 'rented' | 'sale';
  maintenanceStatus: 'paid' | 'pending' | 'overdue';
  createdAt: Date;
}

interface Resident {
  id: string;
  flatId: string;
  societyId: string;
  type: 'owner' | 'tenant' | 'family' | 'staff';
  name: string;
  phone: string;
  email?: string;
  aadhaar?: string;
  relation?: string;
  vehicles: { type: string; number: string; passNumber?: string }[];
  emergencyContact?: { name: string; phone: string; relation: string };
  status: 'active' | 'inactive';
  moveInDate?: Date;
  moveOutDate?: Date;
  createdAt: Date;
}

interface Visitor {
  id: string;
  societyId: string;
  flatId: string;
  visitorType: 'guest' | 'delivery' | 'service' | 'relative' | 'vendor';
  name: string;
  phone?: string;
  fromAddress?: string;
  purpose: string;
  vehicleNumber?: string;
  entryTime?: Date;
  exitTime?: Date;
  entryGate: string;
  exitGate?: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'denied' | 'checked_in' | 'checked_out';
  createdAt: Date;
}

interface Complaint {
  id: string;
  societyId: string;
  flatId?: string;
  category: 'maintenance' | 'security' | 'cleanliness' | 'noise' | 'parking' | 'water' | 'electricity' | 'other';
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
  assignedTo?: string;
  images?: string[];
  resolution?: string;
  rating?: number;
  feedback?: string;
  createdBy: string;
  createdAt: Date;
  resolvedAt?: Date;
}

interface Maintenance {
  id: string;
  societyId: string;
  flatId: string;
  ownerId: string;
  amount: number;
  dueDate: Date;
  paidDate?: Date;
  period: string;
  type: 'monthly' | 'quarterly' | 'annual' | 'special';
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  lateFee: number;
  paymentMethod?: string;
  transactionId?: string;
  createdAt: Date;
}

interface AmenityBooking {
  id: string;
  societyId: string;
  amenityId: string;
  flatId: string;
  residentId: string;
  date: Date;
  startTime: string;
  endTime: string;
  purpose?: string;
  guests?: number;
  status: 'pending' | 'approved' | 'cancelled';
  approvedBy?: string;
  charges?: number;
  createdAt: Date;
}

interface CommitteeMember {
  id: string;
  societyId: string;
  residentId: string;
  role: 'president' | 'vice_president' | 'secretary' | 'joint_secretary' | 'treasurer' | 'member';
  termStart: Date;
  termEnd: Date;
  status: 'active' | 'completed' | 'resigned';
  createdAt: Date;
}

// In-memory stores
const societies = new Map<string, Society>();
const wings = new Map<string, Wing>();
const flats = new Map<string, Flat>();
const residents = new Map<string, Resident>();
const visitors = new Map<string, Visitor>();
const complaints = new Map<string, Complaint>();
const maintenance = new Map<string, Maintenance>();
const amenityBookings = new Map<string, AmenityBooking>();
const committeeMembers = new Map<string, CommitteeMember>();

// ============================================
// SEED DATA
// ============================================

function seedData() {
  // Create a sample society
  const society: Society = {
    id: 'society-1',
    name: 'Green Valley Apartments',
    address: '123 Green Valley Road',
    city: 'Mumbai',
    pincode: '400001',
    type: 'apartment',
    totalWings: 4,
    totalFlats: 200,
    amenities: ['pool', 'gym', 'clubhouse', 'garden', 'parking', 'security', 'intercom', 'power_backup'],
    management: { type: 'society', registrationNo: 'MH/2024/12345' },
    committees: ['maintenance', 'security', 'events'],
    settings: {
      maintenanceDueDay: 10,
      lateFeePercentage: 2,
      visitorApprovalRequired: true,
      gateClosingTime: '22:00',
      gateOpeningTime: '06:00'
    },
    status: 'active',
    createdAt: new Date('2024-01-01')
  };
  societies.set(society.id, society);

  // Create wings
  ['A', 'B', 'C', 'D'].forEach((name, i) => {
    const wing: Wing = {
      id: `wing-${i + 1}`,
      societyId: 'society-1',
      name: `Wing ${name}`,
      code: name,
      floors: 10,
      flatsPerFloor: 5,
      totalFlats: 50,
      liftAvailable: true,
      status: 'active'
    };
    wings.set(wing.id, wing);
  });

  // Create sample flats
  wings.forEach(wing => {
    for (let floor = 1; floor <= wing.floors; floor++) {
      for (let flat = 1; flat <= wing.flatsPerFloor; flat++) {
        const flatNumber = `${floor}${String.fromCharCode(64 + flat)}`;
        const types = ['1BHK', '2BHK', '3BHK'];
        const flatType = types[Math.floor(Math.random() * types.length)];
        const areas = { '1BHK': 650, '2BHK': 950, '3BHK': 1350 };

        const f: Flat = {
          id: `flat-${wing.code}-${flatNumber}`,
          societyId: 'society-1',
          wingId: wing.id,
          flatNumber: `${wing.code}-${flatNumber}`,
          floor,
          type: flatType as Flat['type'],
          carpetArea: areas[flatType as keyof typeof areas],
          builtUpArea: Math.round(areas[flatType as keyof typeof areas] * 1.2),
          status: ['owner_occupied', 'tenant_occupied', 'vacant'][Math.floor(Math.random() * 3)] as Flat['status'],
          maintenanceStatus: ['paid', 'pending', 'overdue'][Math.floor(Math.random() * 3)] as Flat['maintenanceStatus'],
          createdAt: new Date()
        };
        flats.set(f.id, f);
      }
    }
  });

  console.log(`Seeded society: ${society.name}`);
  console.log(`Seeded ${wings.size} wings`);
  console.log(`Seeded ${flats.size} flats`);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSocietyFlats(societyId: string): Flat[] {
  return Array.from(flats.values()).filter(f => f.societyId === societyId);
}

function getSocietyResidents(societyId: string): Resident[] {
  return Array.from(residents.values()).filter(r => r.societyId === societyId);
}

// ============================================
// SOCIETY APIs
// ============================================

app.get('/health', (_req, res) => {
  res.json({
    service: 'rez-society-os',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stats: {
      societies: societies.size,
      wings: wings.size,
      flats: flats.size,
      residents: residents.size,
      visitors: visitors.size,
      complaints: complaints.size
    }
  });
});

// Create society
app.post('/api/societies', (req, res) => {
  const { name, address, city, pincode, type, amenities, management, settings } = req.body;

  if (!name || !address || !city) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'name, address, and city are required' }
    });
    return;
  }

  const id = `society-${uuidv4().slice(0, 8)}`;
  const society: Society = {
    id,
    name,
    address,
    city,
    pincode: pincode || '',
    type: type || 'apartment',
    totalWings: 0,
    totalFlats: 0,
    amenities: amenities || [],
    management: management || { type: 'society' },
    committees: [],
    settings: settings || {
      maintenanceDueDay: 10,
      lateFeePercentage: 2,
      visitorApprovalRequired: true,
      gateClosingTime: '22:00',
      gateOpeningTime: '06:00'
    },
    status: 'pending',
    createdAt: new Date()
  };

  societies.set(id, society);
  res.status(201).json({ success: true, data: society });
});

// Get all societies
app.get('/api/societies', (req, res) => {
  const { city, status, type } = req.query;
  let results = Array.from(societies.values());

  if (city) results = results.filter(s => s.city === city);
  if (status) results = results.filter(s => s.status === status);
  if (type) results = results.filter(s => s.type === type);

  res.json({ success: true, data: results });
});

// Get society by ID
app.get('/api/societies/:id', (req, res) => {
  const society = societies.get(req.params.id);

  if (!society) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Society not found' }
    });
    return;
  }

  // Include wings and flats count
  const societyFlats = getSocietyFlats(society.id);
  const societyWings = Array.from(wings.values()).filter(w => w.societyId === society.id);

  res.json({
    success: true,
    data: {
      ...society,
      wingsCount: societyWings.length,
      flatsCount: societyFlats.length,
      occupancyRate: societyFlats.filter(f => f.status !== 'vacant').length / societyFlats.length * 100
    }
  });
});

// Update society
app.patch('/api/societies/:id', (req, res) => {
  const society = societies.get(req.params.id);

  if (!society) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Society not found' }
    });
    return;
  }

  Object.assign(society, req.body);
  societies.set(society.id, society);

  res.json({ success: true, data: society });
});

// ============================================
// WING APIs
// ============================================

// Add wing
app.post('/api/wings', (req, res) => {
  const { societyId, name, code, floors, flatsPerFloor, liftAvailable } = req.body;

  if (!societyId || !name || !code) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'societyId, name, and code are required' }
    });
    return;
  }

  const society = societies.get(societyId);
  if (!society) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Society not found' }
    });
    return;
  }

  const id = `wing-${uuidv4().slice(0, 8)}`;
  const totalFlats = (floors || 5) * (flatsPerFloor || 4);

  const wing: Wing = {
    id,
    societyId,
    name,
    code,
    floors: floors || 5,
    flatsPerFloor: flatsPerFloor || 4,
    totalFlats,
    liftAvailable: liftAvailable || false,
    status: 'active'
  };

  wings.set(id, wing);

  // Update society counts
  society.totalWings = Array.from(wings.values()).filter(w => w.societyId === societyId).length;
  society.totalFlats += totalFlats;
  societies.set(society.id, society);

  res.status(201).json({ success: true, data: wing });
});

// Get wings by society
app.get('/api/societies/:societyId/wings', (req, res) => {
  const societyWings = Array.from(wings.values())
    .filter(w => w.societyId === req.params.societyId);

  res.json({ success: true, data: societyWings });
});

// ============================================
// FLAT APIs
// ============================================

// Add flat
app.post('/api/flats', (req, res) => {
  const { societyId, wingId, flatNumber, floor, type, carpetArea, builtUpArea } = req.body;

  if (!societyId || !wingId || !flatNumber) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'societyId, wingId, and flatNumber are required' }
    });
    return;
  }

  const id = `flat-${uuidv4().slice(0, 8)}`;
  const flat: Flat = {
    id,
    societyId,
    wingId,
    flatNumber,
    floor: floor || 1,
    type: type || '2BHK',
    carpetArea: carpetArea || 950,
    builtUpArea: builtUpArea || 1140,
    status: 'vacant',
    maintenanceStatus: 'pending',
    createdAt: new Date()
  };

  flats.set(id, flat);
  res.status(201).json({ success: true, data: flat });
});

// Get flats by society
app.get('/api/societies/:societyId/flats', (req, res) => {
  const { wingId, status, type, maintenanceStatus } = req.query;
  let results = getSocietyFlats(req.params.societyId);

  if (wingId) results = results.filter(f => f.wingId === wingId);
  if (status) results = results.filter(f => f.status === status);
  if (type) results = results.filter(f => f.type === type);
  if (maintenanceStatus) results = results.filter(f => f.maintenanceStatus === maintenanceStatus);

  res.json({ success: true, data: results });
});

// Get flat by ID
app.get('/api/flats/:id', (req, res) => {
  const flat = flats.get(req.params.id);

  if (!flat) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Flat not found' }
    });
    return;
  }

  const flatResidents = Array.from(residents.values()).filter(r => r.flatId === flat.id);
  const flatComplaints = Array.from(complaints.values()).filter(c => c.flatId === flat.id);
  const flatMaintenance = Array.from(maintenance.values()).filter(m => m.flatId === flat.id);

  res.json({
    success: true,
    data: {
      ...flat,
      residents: flatResidents,
      complaints: flatComplaints,
      maintenance: flatMaintenance
    }
  });
});

// Update flat
app.patch('/api/flats/:id', (req, res) => {
  const flat = flats.get(req.params.id);

  if (!flat) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Flat not found' }
    });
    return;
  }

  Object.assign(flat, req.body);
  flats.set(flat.id, flat);

  res.json({ success: true, data: flat });
});

// ============================================
// RESIDENT APIs
// ============================================

// Add resident
app.post('/api/residents', (req, res) => {
  const { flatId, societyId, type, name, phone, email, vehicles, emergencyContact } = req.body;

  if (!flatId || !societyId || !name || !phone) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'flatId, societyId, name, and phone are required' }
    });
    return;
  }

  const id = `resident-${uuidv4().slice(0, 8)}`;
  const resident: Resident = {
    id,
    flatId,
    societyId,
    type: type || 'owner',
    name,
    phone,
    email,
    vehicles: vehicles || [],
    emergencyContact,
    status: 'active',
    moveInDate: new Date(),
    createdAt: new Date()
  };

  residents.set(id, resident);

  // Update flat status
  const flat = flats.get(flatId);
  if (flat) {
    if (resident.type === 'owner') {
      flat.ownerId = resident.id;
      flat.status = 'owner_occupied';
    } else if (resident.type === 'tenant') {
      flat.tenantId = resident.id;
      flat.status = 'tenant_occupied';
    }
    flats.set(flat.id, flat);
  }

  res.status(201).json({ success: true, data: resident });
});

// Get residents by society
app.get('/api/societies/:societyId/residents', (req, res) => {
  const { type, status, flatId } = req.query;
  let results = getSocietyResidents(req.params.societyId);

  if (type) results = results.filter(r => r.type === type);
  if (status) results = results.filter(r => r.status === status);
  if (flatId) results = results.filter(r => r.flatId === flatId);

  res.json({ success: true, data: results });
});

// Get resident by ID
app.get('/api/residents/:id', (req, res) => {
  const resident = residents.get(req.params.id);

  if (!resident) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resident not found' }
    });
    return;
  }

  res.json({ success: true, data: resident });
});

// ============================================
// VISITOR APIs
// ============================================

// Register visitor
app.post('/api/visitors', (req, res) => {
  const { societyId, flatId, visitorType, name, phone, purpose, vehicleNumber, entryGate } = req.body;

  if (!societyId || !flatId || !name || !purpose) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'societyId, flatId, name, and purpose are required' }
    });
    return;
  }

  const id = `visitor-${uuidv4().slice(0, 8)}`;
  const visitor: Visitor = {
    id,
    societyId,
    flatId,
    visitorType: visitorType || 'guest',
    name,
    phone,
    purpose,
    vehicleNumber,
    entryGate: entryGate || 'main',
    status: 'pending',
    createdAt: new Date()
  };

  visitors.set(id, visitor);
  res.status(201).json({ success: true, data: visitor });
});

// Approve visitor
app.post('/api/visitors/:id/approve', (req, res) => {
  const visitor = visitors.get(req.params.id);

  if (!visitor) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Visitor not found' }
    });
    return;
  }

  visitor.status = 'approved';
  visitor.entryTime = new Date();
  visitors.set(visitor.id, visitor);

  res.json({ success: true, data: visitor });
});

// Check in visitor
app.post('/api/visitors/:id/checkin', (req, res) => {
  const visitor = visitors.get(req.params.id);

  if (!visitor) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Visitor not found' }
    });
    return;
  }

  visitor.status = 'checked_in';
  visitor.entryTime = new Date();
  visitors.set(visitor.id, visitor);

  res.json({ success: true, data: visitor });
});

// Check out visitor
app.post('/api/visitors/:id/checkout', (req, res) => {
  const visitor = visitors.get(req.params.id);

  if (!visitor) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Visitor not found' }
    });
    return;
  }

  visitor.status = 'checked_out';
  visitor.exitTime = new Date();
  visitors.set(visitor.id, visitor);

  res.json({ success: true, data: visitor });
});

// Get visitors by society
app.get('/api/societies/:societyId/visitors', (req, res) => {
  const { status, date } = req.query;
  let results = Array.from(visitors.values())
    .filter(v => v.societyId === req.params.societyId);

  if (status) results = results.filter(v => v.status === status);
  if (date) {
    const targetDate = new Date(String(date)).toDateString();
    results = results.filter(v => new Date(v.createdAt).toDateString() === targetDate);
  }

  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json({ success: true, data: results });
});

// ============================================
// COMPLAINT APIs
// ============================================

// Create complaint
app.post('/api/complaints', (req, res) => {
  const { societyId, flatId, category, subject, description, priority, createdBy } = req.body;

  if (!societyId || !subject || !description || !createdBy) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'societyId, subject, description, and createdBy are required' }
    });
    return;
  }

  const id = `complaint-${uuidv4().slice(0, 8)}`;
  const complaint: Complaint = {
    id,
    societyId,
    flatId,
    category: category || 'other',
    subject,
    description,
    priority: priority || 'medium',
    status: 'open',
    createdBy,
    createdAt: new Date()
  };

  complaints.set(id, complaint);
  res.status(201).json({ success: true, data: complaint });
});

// Get complaints by society
app.get('/api/societies/:societyId/complaints', (req, res) => {
  const { status, category, priority } = req.query;
  let results = Array.from(complaints.values())
    .filter(c => c.societyId === req.params.societyId);

  if (status) results = results.filter(c => c.status === status);
  if (category) results = results.filter(c => c.category === category);
  if (priority) results = results.filter(c => c.priority === priority);

  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json({ success: true, data: results });
});

// Update complaint status
app.patch('/api/complaints/:id', (req, res) => {
  const complaint = complaints.get(req.params.id);

  if (!complaint) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Complaint not found' }
    });
    return;
  }

  if (req.body.status === 'resolved') {
    complaint.resolvedAt = new Date();
  }

  Object.assign(complaint, req.body);
  complaints.set(complaint.id, complaint);

  res.json({ success: true, data: complaint });
});

// Rate complaint resolution
app.post('/api/complaints/:id/rate', (req, res) => {
  const { rating, feedback } = req.body;
  const complaint = complaints.get(req.params.id);

  if (!complaint) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Complaint not found' }
    });
    return;
  }

  complaint.rating = rating;
  complaint.feedback = feedback;
  complaints.set(complaint.id, complaint);

  res.json({ success: true, data: complaint });
});

// ============================================
// MAINTENANCE APIs
// ============================================

// Generate maintenance bill
app.post('/api/maintenance', (req, res) => {
  const { societyId, flatId, ownerId, amount, dueDate, period, type } = req.body;

  if (!societyId || !flatId || !ownerId || !amount) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'societyId, flatId, ownerId, and amount are required' }
    });
    return;
  }

  const id = `maint-${uuidv4().slice(0, 8)}`;
  const society = societies.get(societyId);
  const lateFee = society ? (amount * society.settings.lateFeePercentage / 100) : 0;

  const bill: Maintenance = {
    id,
    societyId,
    flatId,
    ownerId,
    amount,
    dueDate: new Date(dueDate || Date.now() + 30 * 24 * 60 * 60 * 1000),
    period: period || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    type: type || 'monthly',
    status: 'pending',
    lateFee,
    createdAt: new Date()
  };

  maintenance.set(id, bill);

  // Update flat maintenance status
  const flat = flats.get(flatId);
  if (flat) {
    flat.maintenanceStatus = 'pending';
    flats.set(flat.id, flat);
  }

  res.status(201).json({ success: true, data: bill });
});

// Get maintenance by society
app.get('/api/societies/:societyId/maintenance', (req, res) => {
  const { status, flatId } = req.query;
  let results = Array.from(maintenance.values())
    .filter(m => m.societyId === req.params.societyId);

  if (status) results = results.filter(m => m.status === status);
  if (flatId) results = results.filter(m => m.flatId === flatId);

  res.json({ success: true, data: results });
});

// Pay maintenance
app.post('/api/maintenance/:id/pay', (req, res) => {
  const { paymentMethod, transactionId } = req.body;
  const bill = maintenance.get(req.params.id);

  if (!bill) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Maintenance bill not found' }
    });
    return;
  }

  bill.status = 'paid';
  bill.paidDate = new Date();
  bill.paymentMethod = paymentMethod;
  bill.transactionId = transactionId;
  maintenance.set(bill.id, bill);

  // Update flat maintenance status
  const flat = flats.get(bill.flatId);
  if (flat) {
    flat.maintenanceStatus = 'paid';
    flats.set(flat.id, flat);
  }

  res.json({ success: true, data: bill });
});

// ============================================
// DASHBOARD / ANALYTICS
// ============================================

app.get('/api/societies/:societyId/dashboard', (req, res) => {
  const society = societies.get(req.params.societyId);
  if (!society) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Society not found' }
    });
    return;
  }

  const societyFlats = getSocietyFlats(society.id);
  const societyResidents = getSocietyResidents(society.id);
  const societyComplaints = Array.from(complaints.values()).filter(c => c.societyId === society.id);
  const societyMaintenance = Array.from(maintenance.values()).filter(m => m.societyId === society.id);

  const today = new Date();
  const todayVisitors = Array.from(visitors.values())
    .filter(v => v.societyId === society.id &&
      new Date(v.createdAt).toDateString() === today.toDateString());

  const pendingComplaints = societyComplaints.filter(c => c.status === 'open' || c.status === 'in_progress');
  const overdueMaintenance = societyMaintenance.filter(m => m.status === 'overdue' || m.status === 'pending');
  const collectedMaintenance = societyMaintenance.filter(m => m.status === 'paid');
  const pendingMaintenanceAmount = overdueMaintenance.reduce((sum, m) => sum + m.amount + m.lateFee, 0);
  const collectedMaintenanceAmount = collectedMaintenance.reduce((sum, m) => sum + m.amount, 0);

  res.json({
    success: true,
    data: {
      society,
      stats: {
        totalFlats: societyFlats.length,
        occupiedFlats: societyFlats.filter(f => f.status !== 'vacant').length,
        occupancyRate: (societyFlats.filter(f => f.status !== 'vacant').length / societyFlats.length * 100).toFixed(1),
        totalResidents: societyResidents.length,
        totalVehicles: societyResidents.reduce((sum, r) => sum + r.vehicles.length, 0),
        todayVisitors: todayVisitors.length,
        pendingComplaints: pendingComplaints.length,
        overdueMaintenance: overdueMaintenance.length,
        pendingMaintenanceAmount,
        collectedMaintenanceAmount,
        collectionRate: pendingMaintenanceAmount + collectedMaintenanceAmount > 0
          ? (collectedMaintenanceAmount / (pendingMaintenanceAmount + collectedMaintenanceAmount) * 100).toFixed(1)
          : 0
      },
      maintenanceSummary: {
        pending: overdueMaintenance.length,
        collected: collectedMaintenance.length,
        pendingAmount: pendingMaintenanceAmount,
        collectedAmount: collectedMaintenanceAmount
      },
      complaintSummary: {
        open: societyComplaints.filter(c => c.status === 'open').length,
        inProgress: societyComplaints.filter(c => c.status === 'in_progress').length,
        resolved: societyComplaints.filter(c => c.status === 'resolved').length,
        avgResolutionTime: '2.5 days'
      }
    }
  });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
  });
});

// Start server
seedData();
app.listen(PORT, () => {
  console.log(`REZ Society OS running on port ${PORT}`);
  console.log(`🏢 ${societies.size} societies, ${flats.size} flats, ${residents.size} residents`);
});

export default app;
