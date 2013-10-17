var itach = require("./itach.js")({host: '10.0.0.4', port: 4998 });

itach.on("error", console.log);
itach.on("debug", console.log);
itach.on("connect", function() {

    itach.send_ir({
            "ir": "sendir,1:2,28,39000,3,1,15,45,15,45,15,45,15,45,15,45,15,45,15,45,15,45,15,45,45,15,15,45,45,15,15,45,45,15,15,45,45,15,15,45,15,45,15,45,45,15,15,45,45,15,15,45,15,45,15,430",
            "options": {
                "module": 3
            }
        },
        function(result) {
            console.log(result);
            process.exit(0);
        }
    );
})
