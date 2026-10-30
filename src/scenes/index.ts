import type { SceneModel } from '@graphlearning/graphl-flow'
import { firstLoginScenes } from './first-login'
import { accessScenes } from './access'
import { softwareScenes } from './software'
import { servicesScenes } from './services'
import { webScenes } from './web'
import { automateScenes } from './automate'
import { operateScenes } from './operate'

// Scene registry. Sections reference scenes by id; a graphl-flow scene carries no id of its own, so
// the id is the key here. Scenes are grouped by course (one folder each, mirroring src/content); ids
// are globally unique, and a duplicate THROWS rather than letting one course's scene shadow another's.
const GROUPS: Record<string, SceneModel>[] = [firstLoginScenes, accessScenes, softwareScenes, servicesScenes, webScenes, automateScenes, operateScenes]

export const SCENES: Record<string, SceneModel> = {}
for (const group of GROUPS)
  for (const [id, scene] of Object.entries(group)) {
    if (id in SCENES) throw new Error(`scene id "${id}" is registered twice`)
    SCENES[id] = scene
  }

export function getScene(id: string): SceneModel | undefined {
  return SCENES[id]
}
