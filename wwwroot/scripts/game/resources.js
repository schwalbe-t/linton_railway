
export function load(unloaded) {
    const loaded = {
        isLoaded: false,
        loadHandlers: [],
        onLoad: function(f) {
            if(this.isLoaded) {
                f();
            } else {
                this.loadHandlers.push(f);
            }
        }
    };
    for(const name of Object.keys(unloaded)) {
        unloaded[name].then(r => {
            loaded[name] = r;
            let allLoaded = true;
            for(const name of Object.keys(unloaded)) {
                allLoaded &= Object.hasOwn(loaded, name);
            }
            if(!allLoaded) { return; }
            loaded.isLoaded = true;
            loaded.loadHandlers.forEach(f => f());
            loaded.loadHandlers = [];
        });
    }
    return loaded;
}