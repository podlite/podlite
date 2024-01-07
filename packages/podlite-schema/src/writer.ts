/**
 * Default writer 
 */

import * as Events from 'events'

class Writer extends Events.EventEmitter {
    INDEXTERMS: any[];
    FOOTNOTES: any[];
    output: any;
    errors: any;
    out: any;
    ons: any[];
    // write: (p: any) => void;
    // getStr: () => { errors: any; toString: () => any; valueOf: () => any; };
    // errors: any;
    // out: any;
    // startWrite: () => void;
    // ons: any[];
    // endWrite: () => void;

    constructor(output?) {
        super();
        // save X<> entries
        this.INDEXTERMS = []
        // save N<> annotates
        this.FOOTNOTES = []
        this.output = output
        this.ons=[]
        this.emit('ready');
    }
        // escape function for output
        escape(p) { return p }
        // write with escape special symbols
        write (p) { return this.writeRaw(this.escape(p)) }
        // raw write as is
        writeRaw (str) { 
            if ( 'function' === typeof this.output ) {
                        this.output(str)
            } else {
                console.log(str) 
            }
        }
        getStr () {
            return {
                errors : this.errors,
            toString: () => this.out,
            valueOf: () => this.out
            }
        }
        startWrite (tree:any) {
            // setup events
            ( this.ons || [] ).map( a=> 
                //@ts-ignore
                super.on(...a)
                )
            this.emit('start', tree)
            this.addListener('errors', (err)=>{ this.errors = this.errors || []; this.errors.push(err) })
        }
        on(...params) {
            // overload 'on' method for reverse setup handlers
            this.ons = this.ons || []
            this.ons.unshift( [ ...params ] )
            return this
        }
        endWrite = () => {
            this.emit('end')
        }

        // nesting methods
        
        _add_nesting (n:number) {}
        _remove_nesting (n:number) {}

        addLevel(n:number) {
            this._add_nesting(n)
        }

        removeLevel(n:number) {
            this._remove_nesting(n)
        }

}

export default Writer