
import { GoogleGenAI, Type } from "@google/genai";
import { Aircraft, GameScenario, AlertLevel } from "../types";
import { CENTER, GATE_RADIUS } from "../constants";

// For Vite, environment variables must be prefixed with VITE_
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY || '';

if (!apiKey) {
  console.warn('⚠️ No Gemini API key found. Set VITE_GEMINI_API_KEY in .env.local');
}

const ai = new GoogleGenAI({ apiKey });

// Helper to get coordinate from angle/distance
const getStartPos = (deg: number, dist: number) => {
    const rad = (deg - 90) * (Math.PI / 180);
    return {
        x: CENTER + dist * Math.cos(rad),
        y: CENTER + dist * Math.sin(rad)
    };
};

export const generateScenario = async (difficulty: string): Promise<GameScenario> => {
    let countRange = "12-15"; // Default/Hard target (~15 planes total for waves)
    let speedRange = "210-250";
    
    if (difficulty === 'Easy') {
        countRange = "5-8";
        speedRange = "180-220";
    } else if (difficulty === 'Medium') {
        countRange = "8-12";
        speedRange = "200-240";
    }

    const prompt = `
    Generate an ATC scenario with ${countRange} aircraft.
    Callsigns: Major US Airlines (UAL, AAL, SWA, DAL, SKW, ASH).
    Aircraft Types: B737, A320, B738, A321, E175, CRJ9.
    Altitudes: 50 to 140 (5000-14000ft).
    Speeds: ${speedRange} knots.
    Do not specify coordinates, just flight details.
    `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            aircraft: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  callsign: { type: Type.STRING },
                  type: { type: Type.STRING },
                  altitude: { type: Type.NUMBER },
                  speed: { type: Type.NUMBER },
                },
                required: ["callsign", "type", "altitude", "speed"]
              }
            }
          },
          required: ["name", "description", "aircraft"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");

    // Spawning Zones
    const spawnZones = [
        { id: 'NE', min: 60, max: 80, exitOptions: ['SOU', 'WES'] }, 
        { id: 'SE', min: 130, max: 170, exitOptions: ['NOR', 'WES'] },
        { id: 'SW', min: 220, max: 260, exitOptions: ['NOR', 'EAS'] },
        { id: 'NW', min: 310, max: 350, exitOptions: ['SOU', 'EAS'] }
    ];

    const usedCallsigns = new Set<string>();
    const BACKUP_AIRLINES = ['UAL', 'AAL', 'SWA', 'DAL', 'SKW', 'ASH'];
    
    const generatedAircraft: Aircraft[] = [];

    data.aircraft.forEach((ac: any, index: number) => {
        // 1. Unique Callsign Logic
        let finalCallsign = ac.callsign.toUpperCase().replace(/\s+/g, '');
        while (usedCallsigns.has(finalCallsign)) {
            const airline = BACKUP_AIRLINES[Math.floor(Math.random() * BACKUP_AIRLINES.length)];
            const num = Math.floor(Math.random() * 900) + 100;
            finalCallsign = `${airline}${num}`;
        }
        usedCallsigns.add(finalCallsign);

        // 2. Spawn Position Logic (Waves & Separation)
        const zone = spawnZones[index % spawnZones.length];
        let validPosFound = false;
        let pos = { x: 0, y: 0 };
        let heading = 0;
        let attempts = 0;
        
        // Wave Staggering: 
        // First 5 spawn near edge (GATE_RADIUS to +30nm)
        // Next group spawns further (+50nm to +80nm)
        // Last group spawns way out (+100nm+)
        
        let minDist = 0;
        let maxDist = 0;

        if (index < 5) {
            // Wave 1: Immediate arrivals
            minDist = GATE_RADIUS + 10;
            maxDist = GATE_RADIUS + 40;
        } else if (index < 10) {
            // Wave 2: Mid-range
            minDist = GATE_RADIUS + 100; // ~450px (45NM)
            maxDist = GATE_RADIUS + 200; // ~550px (55NM)
        } else {
            // Wave 3: Long range
            minDist = GATE_RADIUS + 300; // ~650px (65NM)
            maxDist = GATE_RADIUS + 500; // ~850px (85NM)
        }

        while (!validPosFound && attempts < 20) {
            const angle = Math.floor(Math.random() * (zone.max - zone.min + 1)) + zone.min;
            const dist = Math.floor(Math.random() * (maxDist - minDist + 1)) + minDist;
            
            pos = getStartPos(angle, dist);
            
            // Separation Check against already spawned
            const tooClose = generatedAircraft.some(existing => {
                const d = Math.sqrt(Math.pow(existing.x - pos.x, 2) + Math.pow(existing.y - pos.y, 2));
                return d < 60; // 6NM buffer on spawn
            });

            if (!tooClose) {
                validPosFound = true;
                // Initial heading roughly towards center
                heading = (angle + 180 + (Math.random() * 30 - 15)) % 360;
            }
            attempts++;
        }
        
        // If no valid pos found after 20 tries, skip this aircraft or force spawn (we force spawn to keep count)
        if (!validPosFound) {
             // Fallback: just place it further out
             const angle = Math.floor(Math.random() * (zone.max - zone.min + 1)) + zone.min;
             pos = getStartPos(angle, maxDist + (index * 20)); 
             heading = (angle + 180) % 360;
        }

        const destId = zone.exitOptions[Math.floor(Math.random() * zone.exitOptions.length)];

        // 3. Sanitize Altitude (Convert feet to FL if needed)
        // If altitude > 200 (e.g. 5000), divide by 100 to get FL (50).
        let safeAlt = ac.altitude;
        if (safeAlt > 200) safeAlt = Math.round(safeAlt / 100);

        generatedAircraft.push({
            id: `ac-${index}-${Date.now()}`,
            callsign: finalCallsign,
            type: ac.type,
            x: pos.x,
            y: pos.y,
            heading: heading,
            targetHeading: heading,
            altitude: safeAlt,
            targetAltitude: safeAlt,
            speed: ac.speed,
            targetSpeed: ac.speed,
            history: [],
            status: 'INBOUND', 
            cleared: false,
            alertLevel: AlertLevel.NONE,
            messages: [`Checking in, ${safeAlt}00. Requesting ${destId}.`],
            isSelected: false,
            destination: destId,
            dataBlockDir: 45 
        });
    });

    return {
      name: "Sector Control",
      difficulty: difficulty as any,
      description: "Guide aircraft to their assigned exit gates. Avoid collisions.",
      aircraft: generatedAircraft
    };

  } catch (error) {
    console.error("Error generating scenario:", error);
    return {
      name: "Fallback",
      difficulty: "Easy",
      description: "Offline Mode",
      aircraft: []
    };
  }
};

export const getPilotResponse = async (callsign: string, instruction: string): Promise<string> => {
    let readback = instruction.toLowerCase();
    
    readback = readback.replace('climb and maintain', 'climb maintain');
    readback = readback.replace('descend and maintain', 'descend maintain');
    readback = readback.replace('increase speed to', 'speed');
    readback = readback.replace('reduce speed to', 'speed');
    
    readback = readback.toUpperCase();
    
    return `${readback}, ${callsign}.`;
};
