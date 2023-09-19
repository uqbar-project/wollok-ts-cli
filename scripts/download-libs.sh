LIB_FOLDER=./public/diagram/lib

# socket.io
if [ ! -f $LIB_FOLDER/socket.io.esm.min.js ]; then
    wget -P $LIB_FOLDER "https://cdn.socket.io/4.4.1/socket.io.esm.min.js"
fi

# cytoscape
if [ ! -f $LIB_FOLDER/cytoscape.min.js ]; then
    wget -P $LIB_FOLDER "https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js"
fi
