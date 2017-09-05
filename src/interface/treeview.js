var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var DropdownMenu = require('./DropdownMenu');

inherits(TreeView, EventEmitter)

function TreeView() {
    var self = this
    if (!(self instanceof TreeView)) return new TreeView()

    self.dropdown = new DropdownMenu();

    document.getElementById('root-plus').addEventListener('click', function (e) {
        self.emit('add', {
            target: null,
            path: '',
            parentElement: document.querySelector('#tree')
        })
    })
};

TreeView.prototype.render = function (nodeList, parentElement) {
    var self = this;

    parentElement = parentElement || document.querySelector('#tree')

    while (parentElement.firstChild) {

        parentElement.removeChild(parentElement.firstChild);
    }

    for (var i = 0; i < nodeList.length; i++) {
        if (nodeList[i].path === '') continue
        self.add(parentElement, nodeList[i])
    }
};

TreeView.prototype.renameDir = function (nodeList) {
    var self = this;

   self.rerender(nodeList);
};

TreeView.prototype.renameChildren = function (parentElement,file) {
    var self = this;

    self.add(parentElement,file);

    if(file.isDir){
        file.nodes.forEach(function(ele){
            var dirElement = document.getElementById(file.path);
            self.renameChildren(dirElement.parentElement,ele);
        })
    }

}


TreeView.prototype.rerender = function (nodeList) {
    var self = this

    var rootElement = document.querySelector('#tree')
    while (rootElement.firstChild) {
        rootElement.removeChild(rootElement.firstChild)
    }

    self.render(nodeList)
}

TreeView.prototype._handleFileClick = function (e) {
    var self = this
    self.emit('open', {
        target: e.target,
        path: e.target.id,
        parentElement: e.parentElement
    })
}

TreeView.prototype._handleFolderClick = function (e) {
    // var self = this
    // Nothing
}

// Returns parentElement of node if it already exists
TreeView.prototype.getParentElement = function (path) {
    // var self = this
    var el = document.getElementById(path)
    return el ? el.parentElement.parentElement : null
}

TreeView.prototype.remove = function (parentElement, file) {
    // var self = this

    var element = document.getElementById(file.path).parentElement
    parentElement.removeChild(element)
}
/////////////////////////////----------------
// 파일이든 폴더이든 동작은 같다.
/*
TreeView.prototype.rename = function (oldId, newId, children) {
    var self = this

    var element = document.getElementById(oldId);
    element.id = newId;
    element.childNodes[1].id.replace(oldId, newId);
}
*/
TreeView.prototype.add = function (parentElement, file) {
    var self = this

    if (file.isDir) {
        self.addDir(parentElement, file)
    } else {
        self.addFile(parentElement, file)
    }
}

TreeView.prototype.addFile = function (parentElement, file) {
    var self = this

    // Render file
    var el = document.createElement('li')
    el.className = 'file'

    var a = document.createElement('a')
    a.className = 'filelink'
    a.id = file.path
    a.innerHTML = file.name
    a.addEventListener('click', function (e) {
        self.emit('open', {
            target: e.target,
            path: file.path,
            parentElement: parentElement
        })
    })


    self.dropdown.makeDropdownButton(a);
    self.dropdown.addMenu(a.id, 'Rename', function (e) {
        e.stopPropagation();
        console.log('하하 되지롱1~');
    });
    self.dropdown.addMenu(a.id, 'Delete', function (e) {
        e.stopPropagation();
        self.emit('deleteFile', {
            target: e.target,
            path: file.path,
            parentElement: parentElement
        });
    });

    el.appendChild(a)
    parentElement.appendChild(el)
}

TreeView.prototype.addDir = function (parentElement, file) {
    var self = this

    var el = document.createElement('li')

    var label = document.createElement('label')
    //label.setAttribute('for', file.path)
    label.id = file.path
    label.innerHTML = file.name
    label.addEventListener('click', self._handleFolderClick.bind(self))

    var input = document.createElement('input')
    input.id = file.path
    input.checked = true
    input.type = 'checkbox'

    var ol = document.createElement('ol')
    self.render(file.nodes, ol)

    self.dropdown.makeDropdownButton(label);
    self.dropdown.addMenu(label.id, 'add', function (e) {
        e.stopPropagation();
        self.emit('add', {
            target: null,
            path: file.path,
            parentElement: ol
        })
    });
    self.dropdown.addMenu(label.id, 'Rename', function (e) {
        e.stopPropagation();
        self.emit('renameDir', {
            target: e.target,
            path: file.path,
            childElement: el
        });
    });
    self.dropdown.addMenu(label.id, 'Delete', function (e) {
        e.stopPropagation();
        self.emit('removeDir', {
            target: e.target,
            path: file.path,
            parentElement: parentElement
        });
    });

    el.appendChild(label)
    el.appendChild(input)
    el.appendChild(ol)
    parentElement.appendChild(el)
}

module.exports = TreeView
