import {Plugins} from '@podlite/schema'
import Image from '@podlite/image'
import { plugin as Diagram } from '@podlite/diagram';
import Toc from '@podlite/toc';
const external:Plugins = {
    "Image":Image,
    Diagram,
    Toc
}

export default external