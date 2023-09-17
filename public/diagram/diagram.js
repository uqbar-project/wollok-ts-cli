let cy;

function initializeCytoscape(container) {
  const fontFace = {
    "font-family": "Inter",
    "font-weight": "normal",
    "font-size": "data(fontsize)",
  }

  cy = cytoscape({
    container,
    zoom: 1,
    maxZoom: 2,
    minZoom: 0.5,
    elements: [],

    // TODO: Usar classes
    style: [
      // the stylesheet for the graph
      {
        selector: "node",
        style: {
          ...fontFace,
          "background-color": "#7cc0d8",
          "line-color": "#000",
          label: "data(label)",
          color: "#000",
          "text-valign": "center",
          "text-wrap": "ellipsis",
          "text-max-width": "100px",
          "border-style": "solid",
          "border-color": "#248ac8",
          "border-width": "1px",
        },
      },
      {
        selector: "edge",
        style: {
          ...fontFace,
          label: "data(label)",
          width: 1,
          "line-color": "#000000",
          "target-arrow-color": "#000000",
          "target-arrow-shape": "vee",
          "curve-style": "bezier",
          "text-valign": "top",
          "text-margin-y": "10px",
          "font-size": "8px",
        },
      },
      {
        selector: 'node[type = "literal"]',
        style: {
          ...fontFace,
          "background-color": "#6fdc4b",
          "border-color": "#26a324",
        },
      },
      {
        selector: 'node[type = "null"]',
        style: {
          ...fontFace,
          "background-color": "#FFFFFF",
          "font-size": "10px",
          "font-weight": "bold",
          "border-color": "#000000",
        },
      },
      {
        selector: 'node[type = "REPL"]',
        style: {
          opacity: 0,
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
    stop: () => {
      const repl = cy.$("#REPL");
      repl.renderedPosition({ x: -100, y: -100 });
      repl.lock();
    },
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
