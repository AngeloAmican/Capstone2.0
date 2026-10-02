(() => {
  "use strict";

  const treatmentMaterials = {
    "dental consultation": [
      {
        names: ["Disposable Gloves", "Nitrile Gloves", "Latex Gloves"],
        quantity: 1,
      },
      { names: ["Cotton Rolls"], quantity: 1 },
    ],
    "dental cleaning": [
      { names: ["Prophy Paste", "Prophylaxis Paste"], quantity: 1 },
      { names: ["Cotton Rolls"], quantity: 1 },
    ],
    "scaling and polishing": [
      { names: ["Prophy Paste", "Prophylaxis Paste"], quantity: 1 },
      { names: ["Cotton Rolls"], quantity: 1 },
    ],
    "dental whitening": [
      {
        names: ["Fluoride Gel", "Fluoride Varnish", "Fluoride Foam"],
        quantity: 1,
      },
      { names: ["Cotton Rolls"], quantity: 1 },
    ],
    "dental filling": [
      { names: ["Composite Resin", "Composite Resins"], quantity: 1 },
      { names: ["Etching Gel"], quantity: 1 },
      {
        names: ["Dental Bonding Agent", "Bonding Agent", "Universal Bond"],
        quantity: 1,
      },
      { names: ["Microbrush", "Micro Brushes"], quantity: 1 },
      { names: ["Cotton Rolls"], quantity: 1 },
    ],
    "permanent filling": [
      { names: ["Composite Resin", "Composite Resins"], quantity: 1 },
      { names: ["Etching Gel"], quantity: 1 },
      {
        names: ["Dental Bonding Agent", "Bonding Agent", "Universal Bond"],
        quantity: 1,
      },
      { names: ["Microbrush", "Micro Brushes"], quantity: 1 },
      { names: ["Cotton Rolls"], quantity: 1 },
    ],
    "temporary filling": [
      { names: ["Temporary Filling Material"], quantity: 1 },
      { names: ["Cotton Rolls"], quantity: 1 },
    ],
    "tooth restoration": [
      { names: ["Composite Resin", "Composite Resins"], quantity: 1 },
      {
        names: ["Dental Bonding Agent", "Bonding Agent", "Universal Bond"],
        quantity: 1,
      },
      { names: ["Cotton Rolls"], quantity: 1 },
    ],
    "dental crown": [
      { names: ["Dental Cement"], quantity: 1 },
      { names: ["Cotton Rolls"], quantity: 1 },
    ],
    "tooth extraction": [
      { names: ["Sterile Gauze"], quantity: 1 },
      { names: ["Cotton Rolls"], quantity: 1 },
      {
        names: ["Disposable Gloves", "Nitrile Gloves", "Latex Gloves"],
        quantity: 1,
      },
    ],
    "wisdom tooth extraction": [
      { names: ["Sterile Gauze"], quantity: 1 },
      { names: ["Cotton Rolls"], quantity: 1 },
      {
        names: ["Disposable Gloves", "Nitrile Gloves", "Latex Gloves"],
        quantity: 1,
      },
    ],
    "root canal treatment": [
      { names: ["Sterile Gauze"], quantity: 1 },
      { names: ["Cotton Rolls"], quantity: 1 },
      {
        names: ["Disposable Gloves", "Nitrile Gloves", "Latex Gloves"],
        quantity: 1,
      },
    ],
    "oral prophylaxis": [
      { names: ["Prophy Paste", "Prophylaxis Paste"], quantity: 1 },
      { names: ["Cotton Rolls"], quantity: 1 },
    ],
    "gum treatment": [
      { names: ["Sterile Gauze"], quantity: 1 },
      { names: ["Cotton Rolls"], quantity: 1 },
    ],
    "fluoride treatment": [
      {
        names: ["Fluoride Gel", "Fluoride Varnish", "Fluoride Foam"],
        quantity: 1,
      },
      { names: ["Cotton Rolls"], quantity: 1 },
    ],
  };

  const treatmentItemCatalog = [
    ...new Set([
      ...Object.values(treatmentMaterials).flatMap((materials) =>
        materials.flatMap((material) => material.names || []),
      ),
      "Pit and Fissure Sealant",
    ]),
  ];

  window.DentaNuevaTreatmentMaterials = Object.freeze(treatmentMaterials);
  window.DentaNuevaTreatmentItemCatalog = Object.freeze(treatmentItemCatalog);
})();
