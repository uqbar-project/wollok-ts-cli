import { ElementDefinition } from 'cytoscape'
import { BOOLEAN_MODULE, CLOSURE_MODULE, DATE_MODULE, DICTIONARY_MODULE, Entity, getImportedEntities, InnerValue, Interpreter, KEYWORDS, LIST_MODULE, NUMBER_MODULE, Package, PAIR_MODULE, RANGE_MODULE, RuntimeObject, STRING_MODULE, TO_STRING_METHOD, WOLLOK_BASE_PACKAGE } from 'wollok-ts'
import { REPL, replNode } from '../commands/repl'
import { isREPLConstant } from '../utils'

type objectType = 'literal' | 'object' | 'null'

export function getDataDiagram(interpreter: Interpreter, rootFQN?: Package): ElementDefinition[] {
  const environment = interpreter.evaluation.environment
  const importedFromConsole = getImportedEntities(interpreter, replNode(environment), rootFQN)
  const currentFrame = interpreter.evaluation.currentFrame
  const objects = new Map(Array.from(currentFrame.locals.keys()).map((name) => [name, currentFrame.get(name)]))

  // TODO: Aclarar qué está haciendo
  return Array.from(objects.keys())
    .filter((name) => {
      const object = objects.get(name)
      return isConsoleLocal(name) || object && autoImportedFromConsole(object, importedFromConsole)
    })
    .flatMap((name) => fromLocal(name, objects.get(name)!, interpreter))
    .reduce<ElementDefinition[]>((uniques, elem) => {
      if (!uniques.find(uniqueElement => uniqueElement.data.id === elem.data.id))
        uniques.push(elem)
      return uniques
    }, [])
}

function autoImportedFromConsole(obj: RuntimeObject, importedFromConsole: Entity[]) {
  return importedFromConsole.includes(obj.module)
}

function fromLocal(name: string, obj: RuntimeObject, interpreter: Interpreter): ElementDefinition[] {
  return [
    ...isConsoleLocal(name)
      ? buildReplElement(obj, name)
      : [],
    ...elementFromObject(obj, interpreter),
  ]
}

function buildReplElement(obj: RuntimeObject, name: string) {
  const replId = `source_${REPL}_${obj.id}`
  return [
    {
      data: {
        id: replId,
        label: REPL,
        type: REPL,
        fontsize: '8px', // irrelevante porque no se muestra
      },
    },
    {
      data: {
        // Hacemos que cada referencia sea distinta, incluso si apuntan al mismo objeto
        id: `${REPL}_${Math.random() * 100000000}`,
        source: replId,
        target: obj.id,
        width: 1.5,
        label: `${name}${isREPLConstant(obj.module.environment, name) ? '🔒' : ''}`,
        style: 'solid',
        fontsize: getFontSize(name),
      },
    },
  ]
}

function elementFromObject(obj: RuntimeObject, interpreter: Interpreter, alreadyVisited: string[] = []): ElementDefinition[] {
  const { id } = obj
  if (alreadyVisited.includes(id)) return []
  return concatOverlappedReferences([
    { data: { id, ...decoration(obj, interpreter) } },
    ...getInstanceVariables(obj, interpreter, alreadyVisited),
    ...getCollections(obj, interpreter, alreadyVisited),
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
  return !name.includes('.') && !isLanguageLocal(name)
}

function isLanguageLocal(name: string) {
  return name.startsWith(WOLLOK_BASE_PACKAGE) || ['true', 'false', 'null'].includes(name)
}

function getType(obj: RuntimeObject, moduleName: string): objectType {
  if (obj.innerValue === null) return 'null'
  return moduleName.startsWith(WOLLOK_BASE_PACKAGE) ? 'literal' : 'object'
}

function getLabel(obj: RuntimeObject, interpreter: Interpreter): string {
  const { innerValue, module } = obj
  if (innerValue === null) return 'null'
  const moduleName = module.fullyQualifiedName
  if (shouldShortenRepresentation(moduleName)) return showInnerValue(interpreter.send(TO_STRING_METHOD, obj)?.innerValue)
  // Otra opción es enviar el mensaje "printString" pero por cuestiones de performance preferí aprovechar el innerValue
  if (moduleName === STRING_MODULE) return `"${showInnerValue(innerValue)}"`  // TODO: usar fqn o ... hay un isString en Literalc
  if (shouldShowInnerValue(moduleName)) return showInnerValue(innerValue)
  return module.name ?? 'Object'
}

function getFontSize(text: string) {
  const textWidth = text.length
  if (textWidth > 8) return '7px'
  if (textWidth > 5) return '8px'
  return '9px'
}

function shouldShortenRepresentation(moduleName: string) {
  return [DATE_MODULE, PAIR_MODULE, RANGE_MODULE, DICTIONARY_MODULE].includes(moduleName) || moduleName.startsWith(CLOSURE_MODULE)
}

function shouldShowInnerValue(moduleName: string) {
  return [STRING_MODULE, NUMBER_MODULE, BOOLEAN_MODULE].includes(moduleName)
}

function shouldIterateChildren(moduleName: string): boolean {
  return !shouldShortenRepresentation(moduleName) && !shouldShowInnerValue(moduleName)
}

function showInnerValue(innerValue: InnerValue | undefined): string {
  return innerValue?.toString().trim() ?? ''
}

function getLocalKeys(obj: RuntimeObject) {
  const { innerValue, module } = obj
  if (innerValue === null) return []
  const moduleName: string = module.fullyQualifiedName
  return shouldIterateChildren(moduleName) ? [...obj.locals.keys()].filter(key => key !== KEYWORDS.SELF) : []
}

function buildReference(obj: RuntimeObject, label: string) {
  const { id } = obj
  const runtimeValue = obj.get(label)
  return {
    data: {
      id: `${id}_${runtimeValue?.id}`,
      label: `${label}${obj.isConstant(label) ? '🔒' : ''}`,
      source: id,
      target: runtimeValue?.id,
      style: 'solid',
      width: 1,
    },
  }
}

function getCollections(obj: RuntimeObject, interpreter: Interpreter, alreadyVisited: string[]) {
  const { id } = obj
  return (obj.innerCollection || [])
    .flatMap((item, i) => {
      const result = [
        {
          data: {
            id: `${id}_${item.id}`,
            source: id,
            target: item.id,
            label: obj.module.fullyQualifiedName === LIST_MODULE ? i.toString() : '',
            style: 'dotted',
            width: 1,
          },
        },
        ...elementFromObject(item, interpreter, [...alreadyVisited, id]),
      ]
      alreadyVisited.push(item.id)
      return result
    })
}

function getInstanceVariables(obj: RuntimeObject, interpreter: Interpreter, alreadyVisited: string[]) {
  const { id } = obj
  return getLocalKeys(obj).flatMap(name => [
    buildReference(obj, name),
    ...elementFromObject(obj.get(name)!, interpreter, [...alreadyVisited, id]),
  ])
}