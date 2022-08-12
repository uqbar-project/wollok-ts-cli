import cytoscape from 'cytoscape'

const cy = cytoscape({
  container: document.getElementById('cy'), // container to render in

  zoom: 0.2,
  maxZoom: 1,
  elements: [
    {
      data: { id: 'Hola mundo' },
    },
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

const btn = document.getElementById('btn')
btn!.addEventListener('click', addObject)
const id  = document.getElementById('object')
const target = document.getElementById('relation')

function addObject(){
  const myId = (id as HTMLInputElement).value
  const myT = (target as HTMLInputElement).value
  cy.add({
    data: myT? { id: myId+myT, source: myId, target: myT } : { id: myId },
  })
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