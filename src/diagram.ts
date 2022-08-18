import cytoscape, { Core } from 'cytoscape'

let cy: Core

export function initializeCytoscape(container: HTMLElement): void {
  cy = cytoscape({
    container,

    zoom: 1,
    maxZoom: 1,
    minZoom: 0.5,
    elements: [],

    style: [ // the stylesheet for the graph
      {
        selector: 'node',
        style: {
          'background-color': '#666',
          'label': 'data(label)',
        },
      },

      {
        selector: 'edge',
        style: {
          'label': 'data(label)',
          'width': 1,
          'line-color': '#ccc',
          'target-arrow-color': '#ccc',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
        },
      },
    ],
  })
}

export function reloadDiagram(elements: any): void {
  //No funciona? cy.elements().remove
  cy.add(elements)
  cy.layout({
    name: 'cose',
    animate: false,
    nodeDimensionsIncludeLabels: true,
    fit: false,
  }).run()
  cy.pan({
    x: 100,
    y: 100,
  })
}