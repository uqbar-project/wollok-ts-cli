import { ElementDefinition } from 'cytoscape'
import { Entity, Import, InnerValue, Package, RuntimeObject } from 'wollok-ts'
import { Interpreter } from 'wollok-ts/dist/interpreter/interpreter'
import { REPL, replNode } from '../commands/repl'
import { isConstant } from '../utils'

type objectType = 'literal' | 'object' | 'null'

const LIST_MODULE = 'List'
const STRING_MODULE = 'wollok.lang.String'
const WOLLOK_BASE_MODULES = 'wollok.'

const SELF = 'self'

function getImportedDefinitionsFromConsole(interpreter: Interpreter): Entity[] {
  const replPackage = replNode(interpreter.evaluation.environment)
  return [
    ...replPackage.members,
    ...replPackage.imports.flatMap(resolveImport),
  ]
}

function resolveImport(imp: Import): Entity[] {
  const importedEntity = imp.entity.target!
  return imp.isGeneric
    ? [...(importedEntity as Package).members]
    : [importedEntity]
}

export function getDataDiagram(interpreter: Interpreter): ElementDefinition[] {
  const importedFromConsole = getImportedDefinitionsFromConsole(interpreter)
  const currentFrame = interpreter.evaluation.currentFrame
  const objects = new Map(Array.from(currentFrame.locals.keys()).map((name) => [name, currentFrame.get(name)]))

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
        // No funciona sacar la constante
        // label: `${name}${isConstant(obj, name) ? '🔒' : ''}`,
        width: 1.5,
        label: name,
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
  return name.startsWith(WOLLOK_BASE_MODULES) || ['true', 'false', 'null'].includes(name)
}

function getType(obj: RuntimeObject, moduleName: string): objectType {
  if (obj.innerValue === null) return 'null'
  return moduleName.startsWith(WOLLOK_BASE_MODULES) ? 'literal' : 'object'
}

function getLabel(obj: RuntimeObject, interpreter: Interpreter): string {
  const { innerValue, module } = obj
  if (innerValue === null) return 'null'
  const moduleName = module.fullyQualifiedName
  if (shouldShortenRepresentation(moduleName)) return showInnerValue(interpreter.send('toString', obj)?.innerValue)
  // Otra opción es enviar el mensaje "printString" pero por cuestiones de performance preferí aprovechar el innerValue
  if (moduleName === STRING_MODULE) return `"${showInnerValue(innerValue)}"`
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
  // Por ahora el Closure está viniendo como `wollok.lang.Closure#undefined` supongo que porque está en el contexto de un REPL
  return ['wollok.lang.Date', 'wollok.lang.Pair', 'wollok.lang.Range', 'wollok.lang.Dictionary'].includes(moduleName) || moduleName.startsWith('wollok.lang.Closure')
}

function shouldShowInnerValue(moduleName: string) {
  return ['wollok.lang.String', 'wollok.lang.Number', 'wollok.lang.Boolean'].includes(moduleName)
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
  return shouldIterateChildren(moduleName) ? [...obj.locals.keys()].filter(key => key !== SELF) : []
}

function buildReference(obj: RuntimeObject, label: string) {
  const { id } = obj
  const runtimeValue = obj.get(label)
  return {
    data: {
      id: `${id}_${runtimeValue?.id}`,
      label: `${label}${isConstant(obj, label) ? '🔒' : ''}`,
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
            label: isList(obj.module.name) ? i.toString() : '',
            style: 'dotted',
          },
        },
        ...elementFromObject(item, interpreter, [...alreadyVisited, id]),
      ]
      alreadyVisited.push(item.id)
      return result
    })
}

function isList(moduleName: string | undefined) {
  return moduleName === LIST_MODULE
}

function getInstanceVariables(obj: RuntimeObject, interpreter: Interpreter, alreadyVisited: string[]) {
  const { id } = obj
  return getLocalKeys(obj).flatMap(name => [
    buildReference(obj, name),
    ...elementFromObject(obj.get(name)!, interpreter, [...alreadyVisited, id]),
  ])
}