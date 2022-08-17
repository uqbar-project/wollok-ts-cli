import cytoscape, { Core } from 'cytoscape'

let cy: Core

export function initializeCytoscape(container: HTMLElement): void {
  cy = cytoscape({
    container,

    zoom: 0.2,
    maxZoom: 1,
    elements: [
      { data: { id: 'Hola mundo' } },
    ],

    style: [ // the stylesheet for the graph
      {
        selector: 'node',
        style: {
          'background-color': '#666',
          'label': 'data(id)',
        },
      },

      {
        selector: 'edge',
        style: {
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

export function addObject(id: string, target: string): void {
  cy.add({ data: target ? { id: id + target, source: id, target } : { id } })
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