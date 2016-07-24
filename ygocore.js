/*jslint node:true */

'use strict';

/* allows dynamic linking of the ocgapi.dll, critical; */
/* allows use of C++ pointers for C++ JS interactions, critical */
/* allows use of C++ structures for C++ JS interactions, critical */
var sqlite3 = require('sqlite3').verbose(),
    fs = require('fs'),
    os = require('os'),
    ffi = require('ffi'),
    ref = require('ref'),
    struct = require('ref-struct');


function constructDatabase(targetDB, targetFolder) {
    // create instance of card database in memory 2MB, prevents sychronous read request and server lag.
    var database,
        cards = {};

    function handleQueryRow(error, row) {
        if (error) {
            //throw error;
            console.log(error); //fuck it keep moving.
        }
        cards[row.id] = row;
    }

    database = new sqlite3.Database(targetDB);
    database.on("open", function () {
        console.log("database was opened successfully");
    });
    database.on("close", function () {
        console.log("database was closed successfully");
    });
    //database.each(queryfor.statistics, {}, handleQueryRow, function () {}); // get all cards and load into memory.
    //database.end();

    return function (request) {
        //function used by the core to process DB
        var code = request.code;

        return struct({
            code: code,
            alias: cards[code].alias || 0,
            setcode: cards[code].setcode || 0,
            type: cards[code].type || 0,
            level: cards[code].level || 1,
            attribute: cards[code].attribute || 0,
            race: cards[code].race || 0,
            attack: cards[code].attack || 0,
            defence: cards[code].defense || 0
        });
    };
}

function constructScripts(targetFolder) {
    //create instance of all scripts in memory 14MB, prevents sychronous read request and server lag.
    var filelist = [],
        scripts = {};

    function readFile(filename) {
        // loop through a list of filename asynchronously and put the data into memory.
        fs.readfile(targetFolder + '/' + filename, function (error, data) {
            scripts[filename] = data;
            filelist.shift();
            if (filelist.length > 0) {
                readFile(filelist[0]);
            } else {
                return;
            }
        });
    }

    fs.readdir(targetFolder, function (error, list) {
        // get list of script filenames in the folder.
        if (error) {
            throw console.log(error);
        }
        filelist = list;
    });

    return function (id) {
        //function used by the core to process scripts
        var filename = 'c' + id,
            output = new Buffer(scripts[filename]);
        return output;
    };
}

module.exports.configurations = {
    normal: {
        card_reader: constructDatabase('./cards.cdb'),
        script_reader: constructScripts('../YGOPro-Salvation-Server/http/ygopro/script')
    }
};


module.exports.core = function (settings) {
    // create new instance of flourohydride/ygopro/ocgcore

    var bytePointer = ref.types.byte,
        charPointer = ref.types.char,
        intPointer = ref.types.int,
        uint32Pointer = ref.types.uint32,
        voidPointer = ref.types.void,
        cardDataPointer;

    var script_reader = ffi.Function(bytePointer, [charPointer, intPointer]),
        card_reader = ffi.Function('uint32', [cardDataPointer]),
        message_handler = ffi.Function('uint32', [voidPointer, 'uint32']);

    this.ocgapi = ffi.Library(__dirname + '/ocgcorex64.dll', {
        'set_script_reader': ['void', [script_reader]],
        'set_card_reader': ['void', [card_reader]],
        'set_message_handler': ['void', message_handler],
        'create_duel': ['pointer', ['uint32']],
        'start_duel': ['void', ['pointer', 'int']],
        'end_duel': ['void', ['pointer']],
        'set_player_info': ['void', ['pointer', 'int32', 'int32', 'int32', 'int32']],
        'get_log_message': ['void', ['pointer', bytePointer]],
        //'get_message': ['int32', ['pointer', 'byte*']],
        'process': ['int32', ['pointer']],
        'new_card': ['void', ['pointer', 'uint32', 'uint8', 'uint8', 'uint8', 'uint8', 'uint8']],
        'new_tag_card': ['void', ['pointer', 'uint32', 'uint8', 'uint8']],
        'query_card': ['int32', ['pointer', 'uint8', 'uint8', 'int32', bytePointer, 'int32']],
        'query_field_count': ['int32', ['pointer', 'uint8', 'uint8']],
        'query_field_card': ['int32', ['pointer', 'uint8', 'uint8', 'int32', bytePointer, 'int32']],
        'query_field_info': ['int32', ['pointer', bytePointer]],
        'set_responsei': ['void', ['pointer', 'int32']],
        'set_responseb': ['void', ['pointer', bytePointer]],
        'preload_script': ['int32', ['pointer', charPointer, 'int32']]
    });


};