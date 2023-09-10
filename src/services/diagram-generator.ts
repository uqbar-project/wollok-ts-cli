import { ElementDefinition } from 'cytoscape'
import {  RuntimeObject } from 'wollok-ts'
import { isConstant } from '../utils'
import { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'


const REPL = 'REPL'
const replElement: ElementDefinition = { data: { id: REPL, label: REPL, type: 'REPL' }, renderedPosition: { x: -30, y: 30 } }

export function getDataDiagram(interpreter: Interpreter): ElementDefinition[] {
  const diagram = Array.from(interpreter.evaluation.currentFrame.locals.keys())
    .filter((name) =>  !name.startsWith('wollok') && !['true', 'false', 'null'].includes(name))
    .flatMap((name) => fromLocal(name, interpreter.evaluation.currentFrame.get(name)!, interpreter))
    .reduce<ElementDefinition[]>((uniques, elem) => {
      if (!uniques.find(e => e.data.id === elem.data.id))
        uniques.push(elem)
      return uniques
    }, [])

  return diagram.some(elem => elem.data.source === REPL) ? diagram.concat(replElement)    : diagram
}

function fromLocal(name: string, obj: RuntimeObject, interpreter: Interpreter): ElementDefinition[] {
  return [
    ...isConsoleLocal(name)
      ? [
        {
          data: {
            id: `${REPL}_${obj.id}`,
            label: name,
            source: REPL,
            target: obj.id,
          },
        },
      ]
      : [],
    ...elementFromObject(obj, interpreter),
  ]
}

function elementFromObject(obj: RuntimeObject, interpreter: Interpreter, alreadyVisited: string[] = []): ElementDefinition[] {
  const { id } = obj
  if (alreadyVisited.includes(id)) return []
  return concatOverlappedReferences([
    { data: { id, ...decoration(obj, interpreter) } },
    ...[...obj.locals.keys()].filter(key => key !== 'self').flatMap(name => [
      { data: { id: `${id}_${obj.get(name)?.id}`, label: `${name}${isConstant(obj, name) ? '🔒' : ''}`, source: id, target: obj.get(name)?.id } },
      ...elementFromObject(obj.get(name)!, interpreter, [...alreadyVisited, id]),
    ]),
    ...obj.innerCollection ?
      obj.innerCollection.flatMap((item, i) =>
        [
          { data: { id: `${id}_${item.id}`, source: id, target: item.id, label: obj.module.name === 'List' ? i.toString() : ''   } },
          ...elementFromObject(item, interpreter, [...alreadyVisited, id]),
        ]
      )
      : [],
  ])
}


function concatOverlappedReferences(elementDefinitions: ElementDefinition[]): ElementDefinition[] {
  const cleanDefinitions: ElementDefinition[] = []
  elementDefinitions.forEach(elem => {
    if (elem.data.source && elem.data.target) {
      const repeated = cleanDefinitions.find(def => def.data.source === elem.data.source && def.data.target === elem.data.target)
      if (repeated) {
        repeated.data.id = `${repeated.data.id}_${elem.data.id}`
        repeated.data.label = `${repeated.data.label}, ${elem.data.label}`
      } else {
        cleanDefinitions.push(elem)
      }
    } else {
      cleanDefinitions.push(elem)
    }
  })
  return cleanDefinitions
}


// De acá se obtiene la lista de objetos a dibujar
function decoration(obj: RuntimeObject, interpreter: Interpreter) {
  const { innerValue, module } = obj
  const moduleName: string = module.fullyQualifiedName

  if (obj.innerValue === null || ['wollok.lang.Number', 'wollok.lang.Boolean'].includes(moduleName)) return {
    type: 'literal',
    label: `${innerValue}`,
  }

  if (moduleName === 'wollok.lang.String') return {
    type: 'literal',
    label: `"${innerValue}"`,
  }

  return {
    type: 'object',
    label: interpreter.send('kindName', obj)?.innerValue,
  }
}

function isConsoleLocal(name: string): boolean {
  return !name.includes('.')
}
