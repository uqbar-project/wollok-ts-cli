import { ElementDefinition } from 'cytoscape'
import { InnerValue, RuntimeObject } from 'wollok-ts'
import { isConstant } from '../utils'
import { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'

type objectType = 'literal' | 'object' | 'null'

const WOLLOK_BASE_MODULES = 'wollok.'
const SELF = 'self'
const REPL = 'REPL'
const replElement: ElementDefinition = { data: { id: REPL, label: REPL, type: REPL } }

export function getDataDiagram(interpreter: Interpreter): ElementDefinition[] {
  const diagram = Array.from(interpreter.evaluation.currentFrame.locals.keys())
    .filter((name) =>  !name.startsWith('wollok') && !['true', 'false', 'null'].includes(name))
    .flatMap((name) => fromLocal(name, interpreter.evaluation.currentFrame.get(name)!, interpreter))
    .reduce<ElementDefinition[]>((uniques, elem) => {
      if (!uniques.find(e => e.data.id === elem.data.id))
        uniques.push(elem)
      return uniques
    }, [])

  // TODO: ver cómo generar n replElements
  return diagram.some(elem => elem.data.source === REPL) ? diagram.concat(replElement) : diagram
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
    ...getInstanceVariableKeys(obj).flatMap(name => [
      buildReference(obj, id, name),
      ...elementFromObject(obj.get(name)!, interpreter, [...alreadyVisited, id]),
    ]),
    // TODO: extraer en otra función
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
  const moduleName: string = obj.module.fullyQualifiedName
  const label = getLabel(obj, interpreter)

  return {
    type: getType(obj, moduleName),
    label,
    fontsize: getFontSize(label),
  }
}

function isConsoleLocal(name: string): boolean {
  return !name.includes('.')
}

function getType(obj: RuntimeObject, moduleName: string): objectType {
  if (obj.innerValue === null) return 'null'
  return moduleName.startsWith(WOLLOK_BASE_MODULES) ? 'literal' : 'object'
}

function getLabel(obj: RuntimeObject, interpreter: Interpreter): string {
  const { innerValue, module } = obj
  if (innerValue === null) return 'null'
  const moduleName: string = module.fullyQualifiedName
  if (shouldShortenRepresentation(moduleName)) return showInnerValue(interpreter.send('toString', obj)?.innerValue)
  // Otra opción es enviar el mensaje "printString" pero por cuestiones de performance preferí aprovechar el innerValue
  if (moduleName === 'wollok.lang.String') return `"${showInnerValue(innerValue)}"`
  if (shouldShowInnerValue(moduleName)) return showInnerValue(innerValue)
  return showInnerValue(interpreter.send('kindName', obj)?.innerValue)
}

function getFontSize(text: string) {
  const textWidth = text.length
  if (textWidth > 12) return '6px'
  if (textWidth > 5) return '8px'
  return '9px'
}

function shouldShortenRepresentation(moduleName: string) {
  return ['wollok.lang.Date', 'wollok.lang.Pair', 'wollok.lang.Range', 'wollok.lang.Closure'].includes(moduleName)
}

function shouldShowInnerValue(moduleName: string) {
  return ['wollok.lang.String', 'wollok.lang.Number', 'wollok.lang.Boolean'].includes(moduleName)
}

function shouldIterateChildren(moduleName: string): boolean {
  return !shouldShortenRepresentation(moduleName) && !shouldShowInnerValue(moduleName)
}

function showInnerValue(innerValue: InnerValue | undefined): string {
  return innerValue?.toString() ?? ''
}

function getInstanceVariableKeys(obj: RuntimeObject) {
  const { innerValue, module } = obj
  if (innerValue === null) return []
  const moduleName: string = module.fullyQualifiedName
  return shouldIterateChildren(moduleName) ? [...obj.locals.keys()].filter(key => key !== SELF) : []
}

function buildReference(obj: RuntimeObject, id: string, name: string) {
  const runtimeValue = obj.get(name)
  return {
    data: {
      id: `${id}_${runtimeValue?.id}`,
      label: `${name}${isConstant(obj, name) ? '🔒' : ''}`,
      source: id,
      target: runtimeValue?.id,
    },
  }
}