import axios from "axios";
import { logger } from "./logger";

interface LocationValidationResult {
  isValid: boolean;
  confidence: "high" | "medium" | "low";
  normalizedName?: string;
  country?: string;
  state?: string;
  city?: string;
  details?: string;
}

interface GeocodingResult {
  lat: number;
  lon: number;
  display_name: string;
  address: {
    country?: string;
    state?: string;
    city?: string;
    town?: string;
    village?: string;
  };
}

export class LocationValidator {
  private useNominatim: boolean;

  constructor() {
    // Use free Nominatim (OpenStreetMap) by default
    // Can be switched to Google Maps API if GOOGLE_MAPS_API_KEY is set
    this.useNominatim = !process.env.GOOGLE_MAPS_API_KEY;
  }

  /**
   * Validate coordinates and get location details
   */
  async validateCoordinates(
    latitude: number,
    longitude: number
  ): Promise<LocationValidationResult> {
    try {
      // Basic coordinate validation
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return {
          isValid: false,
          confidence: "low",
          details: "Invalid coordinate range",
        };
      }

      // Reverse geocode to get location name
      if (this.useNominatim) {
        return await this.reverseGeocodeNominatim(latitude, longitude);
      } else {
        return await this.reverseGeocodeGoogle(latitude, longitude);
      }
    } catch (error: any) {
      logger.error({ error: error.message, latitude, longitude }, "Failed to validate coordinates");
      return {
        isValid: true,
        confidence: "medium",
        details: "Could not verify location details but coordinates are valid",
      };
    }
  }

  /**
   * Validate text-based location (e.g., "Ojodu market, Lagos")
   */
  async validateTextLocation(locationText: string): Promise<LocationValidationResult> {
    try {
      if (!locationText || locationText.trim().length < 3) {
        return {
          isValid: false,
          confidence: "low",
          details: "Location text too short",
        };
      }

      // Check for Sierra Leone context keywords
      const sierraLeoneKeywords = [
        "freetown",
        "bo",
        "kenema",
        "makeni",
        "koidu",
        "lunsar",
        "port loko",
        "waterloo",
        "kabala",
        "kailahun",
        "moyamba",
        "magburaka",
        "bonthe",
        "pujehun",
        "western area",
        "eastern province",
        "northern province",
        "southern province",
        "sierra leone",
        "salone",
        "district",
        "chiefdom",
      ];

      const lowerText = locationText.toLowerCase();
      const hasSierraLeoneContext = sierraLeoneKeywords.some((keyword) => lowerText.includes(keyword));

      if (this.useNominatim) {
        return await this.geocodeNominatim(locationText, hasSierraLeoneContext);
      } else {
        return await this.geocodeGoogle(locationText);
      }
    } catch (error: any) {
      logger.error({ error: error.message, locationText }, "Failed to validate text location");
      
      // Be skeptical but allow it
      return {
        isValid: true,
        confidence: "low",
        normalizedName: locationText,
        details: "Could not verify location - accepting skeptically",
      };
    }
  }

  private async reverseGeocodeNominatim(
    latitude: number,
    longitude: number
  ): Promise<LocationValidationResult> {
    try {
      const response = await axios.get<GeocodingResult>(
        "https://nominatim.openstreetmap.org/reverse",
        {
          params: {
            lat: latitude,
            lon: longitude,
            format: "json",
            "accept-language": "en",
          },
          headers: {
            "User-Agent": "CrowdsourceAgent/1.0",
          },
          timeout: 5000,
        }
      );

      const data = response.data;

      return {
        isValid: true,
        confidence: "high",
        normalizedName: data.display_name,
        country: data.address.country,
        state: data.address.state,
        city: data.address.city || data.address.town || data.address.village,
      };
    } catch (error: any) {
      logger.warn({ error: error.message }, "Nominatim reverse geocoding failed");
      return {
        isValid: true,
        confidence: "medium",
        details: "Coordinates accepted but could not fetch location details",
      };
    }
  }

  private async geocodeNominatim(
    locationText: string,
    hasSierraLeoneContext: boolean
  ): Promise<LocationValidationResult> {
    try {
      const searchQuery = hasSierraLeoneContext ? locationText : `${locationText}, Sierra Leone`;

      const response = await axios.get<GeocodingResult[]>("https://nominatim.openstreetmap.org/search", {
        params: {
          q: searchQuery,
          format: "json",
          limit: 1,
          "accept-language": "en",
        },
        headers: {
          "User-Agent": "CrowdsourceAgent/1.0",
        },
        timeout: 5000,
      });

      const results = response.data;

      if (results.length === 0) {
        return {
          isValid: true,
          confidence: "low",
          normalizedName: locationText,
          details: "Location not found in map database - accepting skeptically",
        };
      }

      const result = results[0];

      // Check if result is in Sierra Leone
      const isSierraLeone = result.display_name.toLowerCase().includes("sierra leone");

      return {
        isValid: true,
        confidence: isSierraLeone ? "high" : "medium",
        normalizedName: result.display_name,
        country: result.address.country,
        state: result.address.state,
        city: result.address.city || result.address.town || result.address.village,
        details: isSierraLeone ? undefined : "Location found but outside Sierra Leone",
      };
    } catch (error: any) {
      logger.warn({ error: error.message, locationText }, "Nominatim geocoding failed");
      return {
        isValid: true,
        confidence: "low",
        normalizedName: locationText,
        details: "Could not verify location - accepting skeptically",
      };
    }
  }

  private async reverseGeocodeGoogle(
    latitude: number,
    longitude: number
  ): Promise<LocationValidationResult> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_MAPS_API_KEY not set");
    }

    const response = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
      params: {
        latlng: `${latitude},${longitude}`,
        key: apiKey,
      },
      timeout: 5000,
    });

    if (response.data.status !== "OK" || response.data.results.length === 0) {
      return {
        isValid: true,
        confidence: "medium",
        details: "Coordinates accepted but could not fetch location details",
      };
    }

    const result = response.data.results[0];
    const addressComponents = result.address_components || [];

    const country = addressComponents.find((c: any) => c.types.includes("country"))?.long_name;
    const state = addressComponents.find((c: any) => c.types.includes("administrative_area_level_1"))
      ?.long_name;
    const city = addressComponents.find((c: any) => c.types.includes("locality"))?.long_name;

    return {
      isValid: true,
      confidence: "high",
      normalizedName: result.formatted_address,
      country,
      state,
      city,
    };
  }

  private async geocodeGoogle(locationText: string): Promise<LocationValidationResult> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_MAPS_API_KEY not set");
    }

    const response = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
      params: {
        address: locationText,
        region: "sl", // Bias to Sierra Leone
        key: apiKey,
      },
      timeout: 5000,
    });

    if (response.data.status !== "OK" || response.data.results.length === 0) {
      return {
        isValid: true,
        confidence: "low",
        normalizedName: locationText,
        details: "Location not found - accepting skeptically",
      };
    }

    const result = response.data.results[0];
    const addressComponents = result.address_components || [];

    const country = addressComponents.find((c: any) => c.types.includes("country"))?.long_name;
    const isSierraLeone = country?.toLowerCase() === "sierra leone";

    return {
      isValid: true,
      confidence: isSierraLeone ? "high" : "medium",
      normalizedName: result.formatted_address,
      country,
      state: addressComponents.find((c: any) => c.types.includes("administrative_area_level_1"))
        ?.long_name,
      city: addressComponents.find((c: any) => c.types.includes("locality"))?.long_name,
      details: isSierraLeone ? undefined : "Location found but outside Sierra Leone",
    };
  }
}

export const locationValidator = new LocationValidator();
