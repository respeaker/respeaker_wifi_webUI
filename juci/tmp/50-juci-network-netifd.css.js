JUCI.style({"css":"\n/**\n * For the correct positioning of the placeholder element, the dnd-list and\n * it's children must have position: relative\n */\n.simpleDemo ul[dnd-list],\n.simpleDemo ul[dnd-list] > li {\n\tposition: relative;\n}\n\n/**\n * The dnd-list should always have a min-height,\n * otherwise you can't drop to it once it's empty\n */\n.simpleDemo ul[dnd-list] {\n    min-height: 42px;\n    padding-left: 0px;\n}\n\n/**\n * The dndDraggingSource class will be applied to\n * the source element of a drag operation. It makes\n * sense to hide it to give the user the feeling\n * that he's actually moving it.\n */\n.simpleDemo ul[dnd-list] .dndDraggingSource {\n    display: none;\n}\n\n/**\n * An element with .dndPlaceholder class will be\n * added to the dnd-list while the user is dragging\n * over it.\n */\n.simpleDemo ul[dnd-list] .dndPlaceholder {\n    display: block;\n    background-color: #ddd;\n    min-height: 42px;\n}\n\n/**\n * The dnd-lists's child elements currently MUST have\n * position: relative. Otherwise we can not determine\n * whether the mouse pointer is in the upper or lower\n * half of the element we are dragging over. In other\n * browsers we can use event.offsetY for this.\n */\n.simpleDemo ul[dnd-list] li {\n    background-color: #fff;\n    border: 1px solid #ddd;\n    border-top-right-radius: 4px;\n    border-top-left-radius: 4px;\n    display: block;\n    padding: 10px 15px;\n    margin-bottom: -1px;\n}\n\n/**\n * Show selected elements in green\n */\n.simpleDemo ul[dnd-list] li.selected {\n    background-color: #dff0d8;\n    color: #3c763d;\n}\n\n\n\n"});
