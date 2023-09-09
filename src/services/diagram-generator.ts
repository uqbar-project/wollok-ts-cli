import { ElementDefinition } from 'cytoscape'
import { Evaluation, RuntimeObject, Singleton } from 'wollok-ts'
import { isConstant } from '../utils'


const REPL = 'REPL'
const replElement: ElementDefinition = { data: { id: REPL, label: REPL, type: 'object' }, renderedPosition: { x: -30, y: 30 } }

export function getDataDiagram(evaluation: Evaluation): ElementDefinition[] {
  return Array.from(evaluation.currentFrame.locals.keys())
    .filter((name) =>  !name.startsWith('wollok'))
    .flatMap((name) => fromLocal(name, evaluation.currentFrame.get(name)!))
    .concat(replElement)
    .reduce<ElementDefinition[]>((uniques, elem) => {
      if (!uniques.find(e => e.data.id === elem.data.id))
        uniques.push(elem)
      return uniques
    }, [])
}

function fromLocal(name: string, obj: RuntimeObject): ElementDefinition[] {
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
    ...elementFromObject(obj),
  ]
}

function elementFromObject(obj: RuntimeObject, alreadyVisited: string[] = []): ElementDefinition[] {
  const { id } = obj
  if (alreadyVisited.includes(id)) return []
  return concatRepeatedReferences([
    { data: { id, ...decoration(obj) } },
    ...[...obj.locals.keys()].filter(key => key !== 'self').flatMap(name => [
      { data: { id: `${id}_${obj.get(name)?.id}`, label: `${name}${isConstant(obj, name) ? '🔒' : ''}`, source: id, target: obj.get(name)?.id } },
      ...elementFromObject(obj.get(name)!, [...alreadyVisited, id]),
    ]),
    ...obj.innerCollection ?
      obj.innerCollection.flatMap(item =>
        [
          { data: { id: `${id}_${item.id}`, source: id, target: item.id, label: '' } },
          ...elementFromObject(item, [...alreadyVisited, id]),
        ]
      )
      : [],
  ])
}


function concatRepeatedReferences(elementDefinitions: ElementDefinition[]): ElementDefinition[] {
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
function decoration(obj: RuntimeObject) {
  const { id, innerValue, module } = obj
  const moduleName: string = module.fullyQualifiedName

  if (obj.innerValue === null || ['wollok.lang.Number', 'wollok.lang.Boolean'].includes(moduleName)) return {
    type: 'literal',
    label: `${innerValue}`,
  }

  if (moduleName === 'wollok.lang.String') return {
    type: 'literal',
    label: `"${innerValue}"`,
  }

  if (module.is(Singleton) && module.name) return {
    type: 'object',
    label: module.name,
  }

  return { label: `${module.name}#${id.slice(31)}` }
}

function isConsoleLocal(name: string): boolean {
  return !name.startsWith('src.') && !['true', 'false'].includes(name)
}