import { podlitePluggable, Podlite } from '@podlite/schema';
import externalPlugins  from './plugins/extrnal'
export interface PodliteOpt {
    importPlugins: boolean
}


export const podlite = ({ importPlugins = true }:PodliteOpt):Podlite => {
    let plugins = importPlugins ? externalPlugins : {}
    return podlitePluggable({plugins})
}

// Cannot be `import` as it's not under TS root dir
// https://stackoverflow.com/questions/51070138/how-to-import-package-json-into-typescript-file-without-including-it-in-the-comp

const {version: VERSION} = require('../package.json');
export { VERSION as version} 
