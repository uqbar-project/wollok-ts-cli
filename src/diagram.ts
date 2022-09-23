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
          'background-color': '#02e',
          'label': 'data(label)',
          'font-weight': 'bold',
          'color': '#000',
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
      {
        selector: 'node[type = "literal"]',
        style: {
          'background-opacity': 0,
          'text-valign': 'center',
          'color': '#ff3bc3',
          'font-weight': 'bold',
        },
      },
    ],
  })
}

export function reloadDiagram(elements: any): void {
  cy.elements().remove()
  cy.add(elements)
  cy.layout({
    name: 'cose',
    animate: false,
    nodeDimensionsIncludeLabels: true,
    fit: true,
  }).run()
}