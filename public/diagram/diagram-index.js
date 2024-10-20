/* eslint-disable @typescript-eslint/no-unused-vars */
let cy;
let currentElements = [];
function initializeCytoscape(container) {
    const fontFace = {
        'font-family': 'Inter',
        'font-weight': 'normal',
        'font-size': 'data(fontsize)',
    };
    const nodeStyle = Object.assign(Object.assign({}, fontFace), { 'background-color': '#7cc0d8', 'line-color': '#000000', label: 'data(label)', color: '#000', 'text-valign': 'center', 'text-wrap': 'wrap', 'text-max-width': '100px', 'border-style': 'solid', 'border-color': '#248ac8', 'border-width': '1px' });
    const edgeStyle = Object.assign(Object.assign({}, fontFace), { label: 'data(label)', width: 'data(width)', 'line-color': '#000000', 'line-style': 'data(style)', 'target-arrow-color': '#000000', 'target-arrow-shape': 'vee', 'curve-style': 'bezier', 'text-valign': 'top', 'text-margin-y': '10px', 'font-size': '8px' });
    // @ts-ignore
    cy = cytoscape({
        container,
        zoom: 1,
        maxZoom: 2,
        minZoom: 0.5,
        elements: [],
        style: [
            // the stylesheet for the graph
            {
                selector: 'node',
                // @ts-ignore
                style: nodeStyle,
            },
            {
                selector: 'node[mode = "dark"]',
                // @ts-ignore
                style: Object.assign(Object.assign({}, nodeStyle), { 'line-color': '#000000', 'background-color': '#4F709C', 'border-color': '#6F8FC0', color: '#FFFFFF' }),
            },
            {
                selector: 'edge',
                // @ts-ignore
                style: edgeStyle,
            },
            {
                selector: 'edge[mode = "dark"]',
                // @ts-ignore
                style: Object.assign(Object.assign({}, edgeStyle), { 'line-color': '#FFFFFF', 'target-arrow-color': '#FFFFFF', color: '#FFFFFF' }),
            },
            {
                selector: 'node[type = "literal"]',
                // @ts-ignore
                style: Object.assign(Object.assign({}, fontFace), { 'background-color': '#6fdc4b', 'border-color': '#26a324' }),
            },
            {
                selector: 'node[type = "literal"][mode = "dark"]',
                // @ts-ignore
                style: Object.assign(Object.assign({}, fontFace), { 'background-color': '#BB2525', 'border-color': '#E53935', color: '#FFFFFF' }),
            },
            {
                selector: 'node[type = "null"]',
                style: Object.assign(Object.assign({}, fontFace), { 'background-color': '#FFFFFF', 'font-size': '10px', 'font-weight': 'bold', color: '#000000', 'border-color': '#000000' }),
            },
            {
                selector: 'node[type = "REPL"]',
                style: { opacity: 0 },
            },
        ],
    });
}
function updateLayout() {
    updateNodes(cy.elements());
}
function updateNodes(elements) {
    const layout = elements.layout({
        name: 'cose',
        animate: false,
        nodeDimensionsIncludeLabels: true,
        fit: true,
        nodeOverlap: 4,
        randomize: false,
    });
    layout.run();
}
function objectsPositionChanged() {
    const newTitle = objectsKeepTheirPosition() ? 'ON -> objects will keep their positions (better performance when you have > 100 objects)' : 'OFF -> objects will be relocated to fit into the graph layout (graph is easier to read)';
    document.getElementById('toggle-pin').setAttribute('title', `Fix objects position: ${newTitle}`);
}
function objectsKeepTheirPosition() {
    return getInputElement('toggle-pin').checked;
}
function identifier(element) {
    return `${element.data.id}|${element.data.label}`;
}
function reloadDiagram(newElements) {
    const oldElements = [...currentElements];
    currentElements = [...newElements];
    changeElementsMode();
    const oldIds = oldElements.map((oldElement) => identifier(oldElement));
    const newIds = newElements.map((element) => identifier(element));
    const elementsToRemove = oldElements.filter((oldElement) => !newIds.includes(identifier(oldElement)));
    const idsToRemove = elementsToRemove.map((element) => element.data.id);
    cy.filter((element) => idsToRemove.includes(element.id())).remove();
    const elementsToAdd = newElements.filter((element) => !oldIds.includes(identifier(element)));
    if (elementsToAdd.length) {
        const shouldUpdateLayout = !objectsKeepTheirPosition() || cy.elements().length === 0;
        const addedNodes = cy.add(elementsToAdd);
        if (shouldUpdateLayout) {
            updateLayout();
        }
        else {
            updateNodes(readyForLayoutElems(addedNodes));
        }
    }
}
/**
 * edges can't reference nodes that going to be arranged
 */
function readyForLayoutElems(elements) {
    const isInElems = (elem) => elements.some((element) => element.id() === elem.id());
    return elements.filter((element) => element.isNode() ||
        element.isEdge() && isInElems(element.target()) && isInElems(element.source()));
}
function recreateDiagram(currentElements) {
    changeElementsMode();
    cy.elements().remove();
    cy.add(currentElements);
    updateLayout();
}
function modeChanged() {
    const toggleMode = getInputElement('toggle-mode');
    const newTitle = toggleMode.checked ? 'Dark mode ON' : 'Light Mode ON';
    toggleMode.setAttribute('title', newTitle);
    // @ts-expect-error it works and we need it
    document.getElementById('main').style = `background-color: ${backgroundColor()}`;
    recreateDiagram([...currentElements]);
}
function backgroundColor() {
    return isDarkMode() ? 'black' : 'white';
}
function isDarkMode() {
    return getInputElement('toggle-mode').checked;
}
function changeElementsMode() {
    currentElements.forEach(element => { element.data.mode = isDarkMode() ? 'dark' : 'light'; });
}
function getInputElement(id) {
    return document.getElementById(id);
}
//# sourceMappingURL=diagram-index.js.map