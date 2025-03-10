const commonPreload = window.commonPreload;

// textos propios del juego
document.getElementById('columInfoGoal').innerHTML=activityData.lang.columInfoGoal;
document.getElementById('columInfoCtrlTouch').innerHTML=activityData.lang.columInfoCtrlTouch;
document.getElementById('columInfoCtrlDesktop').innerHTML=activityData.lang.columInfoCtrlDesktop;
document.getElementById('columInfoPoints').innerHTML=activityData.lang.columInfoPoints;

const isValidResponse = (response) => {
    return response.RESPUESTA !== '' || response.MULTIMEDIA;
}
        
class Preload extends commonPreload {
    constructor() {
        super('Preload');
        // activityData.data.BLOQUES.filter(bloq => bloq.PREGUNTAS.length > 1 || bloq.PREGUNTAS[0].RESPUESTAS.filter(resp => resp.RESPUESTA !== '' || resp.MULTIMEDIA !== undefined).length == 2).forEach((preg, index) => {
        //     db.preguntas[index] = preg;
        // });
        db.preguntas = activityData.data.BLOQUES
            .map(bloq => {
                const validQuestions = bloq.PREGUNTAS.filter(questions => questions.RESPUESTAS.every(isValidResponse));
                return {
                    ...bloq, 
                    PREGUNTAS: validQuestions
                };
            })
            .filter(bloq => bloq.PREGUNTAS.length > 0);
    }

    loadLanguage() {
        //idioma
        db.juego=db.lang.juegoColum;
    }

    loadGameData() {
        db.puntosMax=100;
        if(activityData.data.MAXIMO!='no'){
            db.tieneTiempoPregunta=1;
            db.tiempoPregunta=activityData.data.TIEMPO;
        }else{
            if(!document.body.classList.contains('g__noend')) {document.body.classList.add('g__noend')}
        }

        if(activityData.data.NUMERO_INTENTOS_INFINITOS === 'no'){
            db.penalizarErrores = 1;
            document.body.classList.add('g__pnlt');
        }

        // var i=0;
        // var multimedia=[];
        // var sinEnunciado=true;
        db.columnMode = true;//activityData.data.DISPLAY === 'columns';

        // let prel = this;
        // multimedia.forEach(function(elemento) {
        //     prel.cambiaABlob(elemento);
        // });
    }

    loadHTML() {
        this.load.html('columBank', assetsURLs.specificHTML + 'columBank.html');
        // this.load.html('cardBody', assetsURLs.specificHTML + 'cardBody.html');
    }

    loadAudio() {
        //carga audios
        this.load.audio('moverLetra', assetsURLs.specificAudio + 'mover-letra.mp3');
        this.load.audio('blank', assetsURLs.specificAudio + 'blank-act.mp3');
        this.load.audio('checkPress', assetsURLs.specificAudio + 'check-press.mp3');
        this.load.audio('mouseHover', assetsURLs.specificAudio + 'mouse-hover.mp3');
        this.load.audio('letraError', assetsURLs.specificAudio + 'letra-error.mp3');
        this.load.audio('correctWord', assetsURLs.specificAudio + 'correct-word.mp3');
        this.load.audio('coin', assetsURLs.specificAudio + 'coin.mp3');
        this.load.audio('live', assetsURLs.specificAudio + 'live.mp3');
    }

    loadEvents() {
        let prel = this;
        if(document.getElementById('play').classList.contains('prss') || location.href.includes('faststart=1')) {
            db.inGame=1;
            loadAndPlay(prel);
        } else {
            db.hacerClick = ()  => {

                db.inGame=1;
                loadAndPlay(prel);

            }

            document.getElementById('play').addEventListener('click',db.hacerClick);

            db.pulsarEnter = (e) => {
                //intro
                if(e.keyCode===13){

                    if(!document.getElementById('g__opt').classList.contains('act') && !db.pantallaFinal && !db.inGame){ 
                        if(smartyData.publiVideo !== false){
                            if(document.getElementById('videoplayer').style.display=='none'){
                                db.inGame=1;
                                loadAndPlay(prel);
                            }
                        }else{
                            db.inGame=1;
                            loadAndPlay(prel);
                        }
                    }
                }
            }
            document.body.addEventListener("keydown", db.pulsarEnter ,{once:true});
        }
    }

}

const loadAndPlay = (preload) => {
    if(preload.load.progress < 1) {
        document.getElementById('g__bg').classList.remove('act');
        document.getElementById('g__hd').classList.remove('act');
        document.getElementById('g__hdg').classList.remove('act');
        document.getElementById('g__cnt__ini').classList.remove('act');
        document.getElementById('eduLdg').classList.add('act');

        preload.load.on('progress', function(progress){
            if(Math.round(progress*100)!=100) document.getElementById('edu_ldg_prc').innerHTML=db.lang.cargando+' '+String(Math.round(progress*100))+'%';
        });

        preload.load.on('complete', () => {
            preload.time.addEvent({
                delay: 1000,
                callback: ()=>{
                    document.getElementById('edu_ldg_prc').innerHTML=db.lang.cargando+' 100%';
                    preload.time.addEvent({
                        delay: 200,
                        callback: ()=>{
                            document.getElementById('eduLdg').classList.remove('act');
                            document.getElementById('g__bg').classList.add('act');
                            preload.scene.start('Comun', { game: 'relacionarColumnas', db: db, fromStartButton: true});
                        }
                    })
                }
            })
        });
    } else {
        document.getElementById('eduLdg').classList.remove('act');
        preload.scene.start('Comun', { game: 'relacionarColumnas', db: db, fromStartButton: true});
    }
}

window.preload = Preload;