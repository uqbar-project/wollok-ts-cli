import { ElementDefinition } from 'cytoscape'
import { DynamicDiagramElement, DynamicDiagramNode, DynamicDiagramReference, getDynamicDiagramData, Interpreter, LIST_MODULE, Package, SET_MODULE } from 'wollok-ts'

export const getDataDiagram = (interpreter: Interpreter, rootFQN?: Package): ElementDefinition[] =>
  getDynamicDiagramData(interpreter, rootFQN)
    .map((dynamicDiagramElement: DynamicDiagramElement) =>
      dynamicDiagramElement.elementType === 'node' ? convertToCytoscapeNode(dynamicDiagramElement as DynamicDiagramNode) : convertToCytoscapeReference(dynamicDiagramElement as DynamicDiagramReference)
    )

const convertToCytoscapeNode = ({ id, type, label }: DynamicDiagramNode): ElementDefinition => ({
  data: {
    id,
    label,
    type,
    fontsize: getFontSize(label),
  },
})

const convertToCytoscapeReference = ({ id, label, sourceId, targetId, sourceModule, constant }: DynamicDiagramReference): ElementDefinition => ({
  data: {
    id,
    label: `${label}${constant ? '🔒' : ''}`,
    source: sourceId,
    target: targetId,
    width: sourceModule ? 1 : 1.5,
    fontsize: getFontSize(label),
    style: getStyle(sourceModule ?? ''),
  },
})

const getFontSize = (text: string): string => {
  const textWidth = text.length
  if (textWidth > 8) return '7px'
  if (textWidth > 5) return '8px'
  return '9px'
}

const getStyle = (sourceModule: string) =>
  [LIST_MODULE, SET_MODULE].includes(sourceModule) ? 'dotted' : 'solid'