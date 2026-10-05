// Ready-made flowchart texts the palette offers: a starter for the dialog and building blocks for an
// administrative procedure, a small network and an ER sketch. Plain text in the supported syntax.

export const DIAGRAM_STARTER = `flowchart TD
  A([Antrag geht ein]) --> B{Vollständig?}
  B -->|ja| C[Bescheid erstellen]
  B -->|nein| D[Unterlagen nachfordern]
  D --> B
  C --> E([Bescheid versenden])`;

// Inserted straight away from the palette; the tests read every one of them (D1).
export const BUILDING_BLOCKS = {
  procedure: DIAGRAM_STARTER,
  network: `flowchart LR
  I((Internet)) --> FW[Firewall] --> R[Router] --> SW[Switch]
  SW --> S1[Server]
  SW --> C1[Client 1]
  SW --> C2[Client 2]`,
  er: `flowchart LR
  K[Kunde] ---|1:n| B[Bestellung]
  B ---|n:m| A[Artikel]
  A ---|n:1| L[Lieferant]`,
} as const;
