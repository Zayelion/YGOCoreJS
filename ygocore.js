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


var bytePointer = ref.refType(ref.types.byte),
    charPointer = ref.refType(ref.types.char),
    intPointer = ref.refType(ref.types.int),
    uint32Pointer = ref.refType(ref.types.uint32),
    voidPointer = ref.refType(ref.types['void']),
    cardData = struct({
        code: ref.types.uint32,
        alias: ref.types.uint32,
        setcode: ref.types.uint64,
        type: ref.types.uint32,
        level: ref.types.uint32,
        attribute: ref.types.uint32,
        race: ref.types.uint32,
        attack: ref.types.int32,
        defense: ref.types.int32,
        lscale: ref.types.uint32,
        rscale: ref.types.uint32
    }),
    cardDataPointer = ref.refType(cardData);


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

    return function (id, length) {

        console.log('SCRIPT ID REQUEST:', id.toString('utf-8'), 'Length:', length);
        return new Buffer([0]);
        //function used by the core to process scripts
        var filename = 'c' + id.toString('utf-8'),
            output = new Buffer(scripts[filename]);
        console.log('OUTPUT:', output);
        return output;
    };
}

module.exports.configurations = {
    normal: {
        card_reader: constructDatabase('./cards.cdb'),
        script_reader: constructScripts('../YGOPro-Salvation-Server/http/ygopro/script')
    }
};

function messagHandler(input) {
    console.log('NEW MESSAGE', input);
}

function duel(instance, players) {
    /*
    1.) who is going first?
    2.) if shuffle, shuffle decks
    3.) set time limit
    4.) set_script_reader
    5.) set_card_reader
    6.) set_message_handler
    7.) create_duel(Random_Number)
    8.) set_player_info(pduel, 0, start_lp, start_hand_count, draw_count);
    9.) set_player_info(pduel, 1, start_lp, start_hand_count, draw_count);
    

    */
}

module.exports.core = function (settings) {
    // create new instance of flourohydride/ygopro/ocgcore

    var pduelPointer = 'pointer', ///really need to figure out the dimensions of this pointer. "pointer" isnt gonna cut it.
        script_reader = ffi.Callback(bytePointer, [charPointer, intPointer], settings.script_reader),
        card_reader = ffi.Callback('uint32', [cardDataPointer], settings.card_reader),
        message_handler = ffi.Callback('uint32', [voidPointer, 'uint32'], messagHandler),
        ocgapi = ffi.Library(__dirname + '/ocgcorex64.dll', {
            'set_script_reader': ['void', [bytePointer]],
            'set_card_reader': ['void', ['uint32']],
            'set_message_handler': ['void', ['uint32']],
            'create_duel': [pduelPointer, ['uint32']],
            'start_duel': ['void', [pduelPointer, 'int']],
            'end_duel': ['void', [pduelPointer]],
            'set_player_info': ['void', [pduelPointer, 'int32', 'int32', 'int32', 'int32']],
            'get_log_message': ['void', [pduelPointer, bytePointer]],
            'get_message': ['int32', [pduelPointer, bytePointer]],
            'process': ['int32', [pduelPointer]],
            'new_card': ['void', [pduelPointer, 'uint32', 'uint8', 'uint8', 'uint8', 'uint8', 'uint8']],
            'new_tag_card': ['void', [pduelPointer, 'uint32', 'uint8', 'uint8']],
            'query_card': ['int32', [pduelPointer, 'uint8', 'uint8', 'int32', bytePointer, 'int32']],
            'query_field_count': ['int32', [pduelPointer, 'uint8', 'uint8']],
            'query_field_card': ['int32', [pduelPointer, 'uint8', 'uint8', 'int32', bytePointer, 'int32']],
            'query_field_info': ['int32', [pduelPointer, bytePointer]],
            'set_responsei': ['void', [pduelPointer, 'int32']],
            'set_responseb': ['void', [pduelPointer, bytePointer]],
            'preload_script': ['int32', [pduelPointer, charPointer, 'int32']]
        });
    ocgapi.set_script_reader(script_reader);
    ocgapi.set_card_reader(card_reader);
    ocgapi.set_message_handler(message_handler);


    ocgapi.pduel = ocgapi.create_duel(0);
    console.log('pDuel', pduel);
};