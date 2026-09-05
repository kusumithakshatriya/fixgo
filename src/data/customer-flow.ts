export type RepairRequest = {
  id: string;
  service: string;
  description: string;
  location: string;
  preferredTime: string;
  photoUri?: string;
  photoName?: string;
};

export type Technician = {
  id: string;
  name: string;
  service: string;
  rating: number;
  reviews: number;
  jobs: number;
  years: number;
  distance: number;
  price: number;
  arrival: number;
  match: number;
  verified: true;
  specialization: string;
  reasons: string[];
};

export type LocalBooking = {
  id: string;
  request: RepairRequest;
  technician: Technician;
  status: 'Technician Assigned';
};

export const technicians: Technician[] = [
  { id: 'rajesh-kumar', name: 'Rajesh Kumar', service: 'AC Repair', rating: 4.8, reviews: 127, jobs: 127, years: 8, distance: 1.2, price: 450, arrival: 25, match: 94, verified: true, specialization: 'AC repair specialist', reasons: ['Strong AC Repair expertise', 'Excellent customer rating', 'Closest available technician'] },
  { id: 'anil-kumar', name: 'Anil Kumar', service: 'AC Repair', rating: 4.6, reviews: 89, jobs: 89, years: 5, distance: 2.1, price: 380, arrival: 18, match: 88, verified: true, specialization: 'AC repair specialist', reasons: ['Most competitive estimated price', 'Fastest arrival time', 'Verified AC Repair experience'] },
  { id: 'suresh-rao', name: 'Suresh Rao', service: 'AC Repair', rating: 4.9, reviews: 164, jobs: 164, years: 10, distance: 3.4, price: 520, arrival: 32, match: 91, verified: true, specialization: 'AC repair specialist', reasons: ['Highest customer rating', 'Most repair experience', 'Strong service track record'] },
];

let activeRequest: RepairRequest | null = null;
let selectedTechnician: Technician | null = null;
let confirmedBooking: LocalBooking | null = null;

export function setActiveRequest(request: RepairRequest) { activeRequest = request; selectedTechnician = null; }
export function getActiveRequest() { return activeRequest; }
export function setSelectedTechnician(technician: Technician) { selectedTechnician = technician; }
export function getSelectedTechnician() { return selectedTechnician; }
export function getConfirmedBooking() { return confirmedBooking; }
export function confirmLocalBooking(request: RepairRequest, technician: Technician) {
  confirmedBooking = { id: `FG-${technician.id.slice(0, 2).toUpperCase()}-${technician.arrival}-${technician.price}`, request, technician, status: 'Technician Assigned' };
  return confirmedBooking;
}
