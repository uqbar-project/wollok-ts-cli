import cytoscape from "https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.23.0/cytoscape.esm.min.js";

let cy;

function initializeCytoscape(container) {
  cy = cytoscape({
    container,
    zoom: 1,
    maxZoom: 2,
    minZoom: 0.5,
    elements: [],

    style: [
      // the stylesheet for the graph
      {
        selector: "node",
        style: {
          "background-color": "#02e",
          label: "data(label)",
          "font-weight": "bold",
          color: "#000",
        },
      },

      {
        selector: "edge",
        style: {
          label: "data(label)",
          width: 1,
          "line-color": "#ccc",
          "target-arrow-color": "#ccc",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
        },
      },
      {
        selector: 'node[type = "literal"]',
        style: {
          "text-valign": "center",
          color: "#ff3bc3",
          "font-weight": "bold",
        },
      },
    ],
  });
}

function updateLayout() {
  cy.layout({
    name: "cose",
    animate: true,
    nodeDimensionsIncludeLabels: true,
    fit: true,
  }).run();
}

function reloadDiagram(elements) {
  const ids = elements.map((e) => e.data.id);
  cy.filter((e) => !ids.includes(e.id())).remove();

  const newElements = elements.filter((e) => !cy.hasElementWithId(e.data.id));
  if (newElements.length) {
    cy.add(newElements);
    updateLayout();
  }
}

export { reloadDiagram, initializeCytoscape };
