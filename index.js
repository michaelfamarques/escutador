const winston = require('winston');
const record = require('node-record-lpcm16');
const request = require('request');
const glob = require('glob');
const path = require('path');
const fs = require('fs');
const Detector = require('./lib/index').Detector;
const Models = require('./lib/index').Models;
const models = new Models();
const args = require('minimist')(process.argv.slice(2));
const wol = require('wake_on_lan');
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

if (args.model) {

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
		logger.info(response.statusCode);
		logger.info(response.body);
		process.exit();
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
		sensitivity: '0.5',
		hotwords: path.basename(m, '.umdl')
	});
});

const detector = new Detector({
	resource: "resources/common.res",
	models: models,
	audioGain: 2.0
});

//detector.on('silence', function () {});
//detector.on('sound', function (buffer) {});

detector.on('error', function () { logger.info('error'); });

detector.on('hotword', function (index, hotword, buffer) { // Buffer arguments contains sound that triggered the event, for example, it could be written to a wav stream 
	switch(hotword){
		case "ligarnote":
			logger.info("Enviando pacotes para ligar o notebook...");
			wol.wake('B0:25:AA:18:32:92');
		break;
	}
});

//logger.info("1");

const mic = record.start({
	threshold: 0
});

//logger.info("2");

mic.pipe(detector);

//logger.info("3");

logger.info("Iniciando escutador...");