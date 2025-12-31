
# OpenSTARS Emulator - Rules & Procedures

Welcome to the OpenSTARS radar terminal emulator. Your goal is to safely guide aircraft from their entry points to their assigned Exit Gates while maintaining separation and adhering to strict altitude restrictions.

## 1. Objectives
*   **Guide Aircraft to Exit Gates**: Each aircraft has a 3-letter code in its data block (e.g., `NOR`, `SOU`, `EAS`, `WES`). This is their assigned exit.
*   **Maintain Separation**: Keep aircraft apart to avoid collisions.
*   **Verify Altitudes**: Ensure aircraft cross the exit gate at the correct altitude.

## 2. Scoring System

### Gaining Points
*   **Perfect Exit (+1000)**: Aircraft flies through the center of the correct gate (without touching the parallel corridor lines) at the correct altitude.
*   **Sloppy Exit (+500)**: Aircraft passes through the correct gate but touches/overlaps the parallel boundary lines.

### Losing Points (Penalties)
*   **Wrong Altitude (-250)**: Correct gate, but incorrect altitude (see Altitude Rules below).
*   **Wrong Gate (-500)**: Aircraft exits via a gate other than its assigned destination.
*   **Off Course (-200)**: Aircraft leaves the radar scope through a wall (not a gate).
*   **Separation Bust (-50/tick)**: **SEVERE**. Points are deducted continuously while two aircraft are in a "RED" alert state (Loss of Separation).

## 3. Altitude Rules (CRITICAL)
You must climb or descend aircraft to specific altitudes based on their exit direction.

| Exit Gate | Valid Altitudes (FL) | Rule Type |
| :--- | :--- | :--- |
| **NORTH (NOR)** | **7000** (070), **9000** (090) | ODD |
| **EAST (EAS)** | **7000** (070), **9000** (090) | ODD |
| **SOUTH (SOU)** | **6000** (060), **8000** (080) | EVEN |
| **WEST (WES)** | **6000** (060), **8000** (080) | EVEN |

## 4. Separation Standards
*   **Lateral**: 3 Nautical Miles (NM).
*   **Vertical**: 1,000 feet.
*   **Diverging Exception**: If aircraft are diverging (moving apart) by **15 degrees or more**, lateral separation is not required (Tail-to-Tail rule).

### Alert Colors
*   **RED (CRITICAL)**: < 3NM and Converging. (Points Lost!)
*   **YELLOW (WARNING)**: < 4NM or Diverging. (Monitor closely).

## 5. Controls & Interface

### Data Block Management
You can move the text label around the aircraft target to prevent overlapping.
*   **Select Aircraft**: Click the target or type the callsign.
*   **Move Label**: Use **Numpad Keys (1-9)** or **Arrow Keys**.
*   **NOTE**: If you are typing in the command box, hold **SHIFT** + **Numpad/Arrows** to move the label.

### Simulation Speed
Use the buttons in the top right corner of the map to speed up time (1x, 2x, 4x, 10x) during long transits.

## 6. Command Reference
Commands can be typed in the input box. You can chain commands together.

### Heading (H)
*   **`H [heading]`**: Turn shortest direction.
    *   *Ex:* `UAL123 H 090`
*   **`TL [heading]`**: Turn **LEFT** (Force left turn).
    *   *Ex:* `UAL123 TL 270`
*   **`TR [heading]`**: Turn **RIGHT** (Force right turn).
    *   *Ex:* `UAL123 TR 090`

### Altitude (A)
*   **`A [altitude]`**: Climb or Descend to altitude (in hundreds).
    *   *Ex:* `UAL123 A 070` (Climb/Descend to 7,000ft)
    *   *Ex:* `UAL123 C 070` (Alternate syntax)

### Speed (S)
*   **`S [knots]`**: Increase or Reduce speed.
    *   *Ex:* `UAL123 S 210` (Maintain 210 knots)

### Combined Commands
You can issue multiple instructions in a single line. Spaces are optional between letters and numbers.
*   `UAL123 H090 A070` (Turn 090, Altitude 7000)
*   `AAL404 TL270 S210 A060` (Turn Left 270, Speed 210, Altitude 6000)
