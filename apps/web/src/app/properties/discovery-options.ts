export const discoveryAreas = [
  "Ha Thetsane",
  "Khubetsoana",
  "Mabote",
  "Maseru West",
  "Qoaling",
  "Roma",
  "Thetsane",
  "Upper Thamae",
] as const;

export const discoveryRoomTypes = [
  "Apartment",
  "Private room",
  "Shared room",
  "Single room",
  "Studio",
] as const;

export const discoveryInstitutions = [
  "Botho University Lesotho",
  "Lerotholi Polytechnic",
  "Lesotho College of Education",
  "Limkokwing University of Creative Technology",
  "National University of Lesotho",
] as const;

export const discoveryAmenities = [
  "Furnished",
  "Kitchen",
  "Parking",
  "Public transport",
  "Security",
  "Study desk",
  "Water included",
  "Wi-Fi",
] as const;

export const discoveryPriceRange = {
  min: 500,
  max: 5_000,
  step: 50,
} as const;
