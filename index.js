const winston = require('winston');
const record = require('node-record-lpcm16');
const request = require('request');
const glob = require('glob');
const path = require('path');
const fs = require('fs');
const Detector = require('./lib/index').Detector;
const Models = require('./lib/index').Models;
const Led = require('./lib/led');
const models = new Models();
const args = require('minimist')(process.argv.slice(2));
const wol = require('wake_on_lan');
const child_process = require('child_process');

var logger = new(winston.Logger)({
	transports: [
		new(winston.transports.Console)(),
		new(winston.transports.File)({
			filename: '/var/log/escutador.log'
		})
	]
});

const snowboyJson = {
    "name": "",
    "language": "pt",
    "age_group": "20_29",
    "gender": "M",
    "microphone": "ps3 eye",
    "token": "87af2f15c8b08c6fea987e33b9152d3f867da137",
    "voice_samples": []
};

Led.off();

if (args.model) {

	// comando para gravar
	// rec -r 16000 -c 1 -b 16 -e signed-integer arquivo.wav

	let files = glob.sync("wavs/"+args.model+"*.wav");
	let json = JSON.parse(JSON.stringify(snowboyJson));

	json.name = args.model;
	
	if(files.length == 0){
		logger.info("Nenhum arquivo wav encontrado com o nome de "+args.model+"!");
		return process.exit(1);
	}

	files.forEach((f) => {
		json.voice_samples.push({
			wave: Buffer.from(fs.readFileSync(f)).toString("base64")
		})
	});

	logger.info("Enviando termo "+args.model+" com "+files.length+" arquivos para treinamento...");

	fs.writeFileSync("treino.json", JSON.stringify(json, null, 4));

	request({
		method: "POST",
		url: "https://snowboy.kitt.ai/api/v1/train/",
		body: JSON.stringify(json),
		headers: {
			'Content-type': 'application/json'
		}
	})
	.on('error', function(err) {
		logger.error("Erro ao treinar termo "+args.model+": ");
		logger.error(err);
		process.exit();
	})
	.on('response', (response) => {
		logger.info("Treinamento realizado, salvando arquivo umdl.");
	})
	.pipe(fs.createWriteStream('resources/'+args.model+'.umdl'));

	return;
}

let modelFiles = glob.sync("resources/*.umdl");

if(modelFiles.length == 0){
	logger.info("Nenhum arquivo umdl encontrado!");
	return process.exit(1);
}

modelFiles.forEach((m) => {
	models.add({
		file: m,
		sensitivity: '0.375',
		hotwords: path.basename(m, '.umdl')
	});
});

const detector = new Detector({
	resource: "resources/common.res",
	models: models,
	audioGain: 3.0
});

//detector.on('silence', function () {});
//detector.on('sound', function (buffer) {});

detector.on('error', function () { logger.info('error'); });

var odroidAtivo = false;
var timeout = null;

function falaAceita(){
	Led.on();
	clearInterval(timeout);
	timeout = setTimeout(() => {
		odroidAtivo = false;
		Led.off();		
	}, 4000);
}

detector.on('hotword', function (index, hotword, buffer) { // Buffer arguments contains sound that triggered the event, for example, it could be written to a wav stream 
	
	logger.info('Hotword: '+hotword);

	if(odroidAtivo){
		switch(hotword){
			case "ligarnote":
				falaAceita();
				logger.info("Enviando pacotes para ligar o notebook...");
				wol.wake('B0:25:AA:18:32:92');
			break;
			case "notedesligar":
				falaAceita();
				logger.info("Enviando comando para desligar o notebook...");
        		child_process.execSync('desligar-note');				
			break;
			case "tvdesligar":
				falaAceita();
				logger.info("Enviando comando para desligar a tv...");
        		child_process.execSync('echo "standby 0" | cec-client -s');
			break;
			case "tvligar":
				falaAceita();
				logger.info("Enviando comando para ligar a tv...");
        		child_process.execSync('echo "on 0" | cec-client -s');
			break;
		}
	}

	if(!odroidAtivo && hotword == "odroid"){
		logger.info("Escutando...");
		Led.heartbeat();
		odroidAtivo = true;
		timeout = setTimeout(() => {
			odroidAtivo = false;
			Led.off();
		}, 6000);
	}

});

const mic = record.start({
	threshold: 0,
	silence: 0
});

mic.pipe(detector);

logger.info("Iniciando escutador...");
