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
  updateNodes(cy.elements());
}

function updateNodes(elements) {
  const layout = elements.layout({
    name: "cose",
    animate: false,
    nodeDimensionsIncludeLabels: true,
    fit: true,
  });

  layout.run();
}

function reloadDiagram(elements) {
  const ids = elements.map((e) => e.data.id);
  cy.filter((e) => !ids.includes(e.id())).remove();

  const newElements = elements.filter((e) => !cy.hasElementWithId(e.data.id));
  if (newElements.length) {
    let shouldUpdateLayout = false;
    if (cy.elements().length === 0) {
      shouldUpdateLayout = true;
    }
    const addedNodes = cy.add(newElements);
    if (shouldUpdateLayout) {
      updateLayout();
    } else {
      updateNodes(readyForLayoutElems(addedNodes));
    }
  }
}

/**
 * edges cant references nodes that going to be arranged
 */
function readyForLayoutElems(elems) {
  const isInElems = (elem) => elems.some((e) => e.id() === elem.id());

  return elems.filter(
    (e) =>
      e.isNode() ||
      (e.isEdge() && isInElems(e.target()) && isInElems(e.source()))
  );
}
