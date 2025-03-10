const comunBootloader = window.commonBootloader;
let bootloader;

//enum with states for the cells
const cellState = {
	DEFAULT: Symbol("DEFAULT"),
	SELECTED: Symbol("SELECTED"),
    PAIRED: Symbol("PAIRED")
}

const THRESHOLD_Y = .25;
const ACCELERATION = 20;
const BULLET_SIZE_TOUCH = 12;
const BULLET_SIZE = 9;

const getScrollSpeed = ({ scrollContainer, position }) => {
    const isTop = scrollContainer.scrollTop <= 0;
    const isBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight;

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const threshold = scrollContainerRect.height * THRESHOLD_Y;

    if (!isTop && position <= scrollContainerRect.top + threshold) {
        const speed =
            ACCELERATION *
            Math.abs(
                (scrollContainerRect.top + threshold - position) / threshold
            );

        return speed * -1
    }

    if (!isBottom && position >= scrollContainerRect.bottom - threshold) {
        const speed =
            ACCELERATION *
            Math.abs(
                (scrollContainerRect.bottom - threshold - position) /
                threshold
            );

        return speed;
    }

    return 0;
}

const TOUCH_EVENTS = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];

function getCoords(e) {
    if (TOUCH_EVENTS.includes(e.type)) {
        const touch = e.touches[0] || e.changedTouches[0];

        return {
            x: touch.pageX,
            y: touch.pageY
        }
    }

    return {
        x: e.clientX,
        y: e.clientY
    }
}

class Bootloader extends comunBootloader {
    constructor() {
        super('Bootloader');
        this.elements = {
            container: document.getElementById('gCntr'),
            points: document.getElementById('gPts'),
            lives: document.getElementById('gLvs'),
            clock: document.getElementById('gClk'),
            exitButton: document.getElementById('exit'),
            question: document.getElementById('gQst')
        };
        this.config = {
            lifeCoord: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
            destroyPointsDelay: 1900,
            feedbackDelay: 300,//wn y wrg
            pointsDelay: 300,//puntos
            lifeDelay: 800, //vida
            wrongDelay: 800, //quitar wrg
            gameEndDelay: 400, //end of game
            screenEndDelay: 2000, //end of screen
            pointsPerScreen: Math.round((100 / db.preguntas.length) * 1000) / 1000,
        }
        this.actCell = null;
        bootloader = this;
        this.hasInitialized = false;
    }

    setHTML() {
        this.elements.points.innerHTML = Math.round(db.puntos);
    }

    setGameData() {
        this.puntosPalabra =  Math.floor((db.puntosMax / db.preguntas.length) * 1000) / 1000; 
    }

    setAudio() {
        if(!db.sonidoJuego) { return; }
        //anado audios
        this.blank = this.sound.add('blank');
        this.checkPress = this.sound.add('checkPress');
        this.mouseHover = this.sound.add('mouseHover');
        this.letraError = this.sound.add('letraError');
        this.correctWord = this.sound.add('correctWord');
        this.coin = this.sound.add('coin');
        this.live = this.sound.add('live');
        this.moverLetra = this.sound.add('moverLetra');
    }

    setEvents() {
        document.body.removeEventListener("keydown", db.pulsarEnter);
        document.getElementById('play').removeEventListener('click',db.hacerClick);

        document.getElementById('si__sndCtv_exit').addEventListener('click', function() {
            bootloader.allAudios.forEach(audio => audio.stopAudio());
            gameOver();
        });
    }

    iniciarJuego(bootloader) {
        if(bootloader.hasInitialized) return;
        bootloader.hasInitialized = true;
        //audio inicio
        bootloader.reproduceAudio(bootloader.intro,0,0.3);

        this.elements.container.style.zIndex='';
        
        bootloader.elements.exitButton.classList.add('act');

        if(!db.columnMode) { document.body.classList.add('g__par--msc') }

        // create info
        bootloader.infoBank = document.createElement('div');
        bootloader.infoBank.classList.add('g__info');
        bootloader.infoBank.innerHTML = bootloader.cache.html.get('columBank');
        this.elements.container.parentNode.appendChild(bootloader.infoBank);
        bootloader.infoBank.getElementsByClassName('g__info__nbr__hd')[0].innerHTML = db.lang.pairs;
        bootloader.infoBank.getElementsByClassName('g__info__scrn__hd')[0].innerHTML = db.lang.pagina;
        bootloader.infoBank.getElementsByClassName('gColumInfoBnkScrns')[0].innerHTML = db.preguntasMaximasReal;

        //create grid
        bootloader.columContainer = createGrid();
        this.elements.container.parentNode.appendChild(bootloader.columContainer);
        bootloader.columGrid = document.getElementById('gParGrd');

        bootloader.cells = [];
        

        bootloader.matches = [];
        window.addEventListener('resize', () => {
            bootloader.columContainer.scrollTo(0, 0);
            bootloader.config.lifeCoord = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

            const updatedCards = () => {
                bootloader.arrowPainter.reset();

                bootloader.cells.forEach(cell => cell.restart());

                this.matches.forEach(pair => {
                    bootloader.arrowPainter.drawArrow({ origin: pair.actCell.getPosition(), target: pair.altCell.getPosition(), className: 'line-fll' });
                });
            }
            setTimeout(updatedCards, 350);
        })

        siguientePregunta();

        //d&d line
        const svg = document.querySelector(".svg-lines");
        bootloader.arrowPainter = new ArrowPainter({ svg, gridElement: bootloader.columGrid, scrollElement: bootloader.columContainer, color: 'black' });
    }
}

const createGrid = () => { 
    let columContainer = document.createElement('div');
    columContainer.setAttribute('id', 'gParCntr');
    columContainer.classList.add('g__par__ctnr');
    columContainer.innerHTML = `
        <div id="gParGrd" class="g__par__grd">
            ${db.columnMode ? '<div class="g__par__grd__col"></div><div class="g__par__grd__col"></div>' : ''}
        </div>
        <svg class="svg-lines" width="100%" height="100%" viewBox="0 0 577 306" preserveAspectRatio="none"></svg>`
    return columContainer;
}

const shuffle = (array) => {
    let auxArray = array;
    var m = array.length, t, i;
    // While there remain elements to shuffle…
    while (m) {
        // Pick a remaining element…
        i = Math.floor(Math.random() * m--);
        // And swap it with the current element.
        [auxArray[m], auxArray[i]] = [auxArray[i], auxArray[m]];
    }
    return auxArray;
}

function getCellContent(element, id) {
    const content = [];
    switch (element.MULTIMEDIA_TIPO) {
        case 'image':
            // const imageContent = createImageComponent(bootloader, id, db.resources + element.MULTIMEDIA, true, false);
            // content.push(imageContent);
            const imageContent = new ImageComponent({bootloader, id, source: db.resources + element.MULTIMEDIA});
            // imageContent.lupa.style.setProperty('z-index', 2);
            // imageContent.lupa.style.setProperty('pointer-events', 'auto');
            imageContent.imageElement.addEventListener('click', (e) => {
                imageContent.open();
                e.stopPropagation();
            });
            if(!bootloader.sys.game.device.os.desktop) {
                imageContent.node.addEventListener('pointerover', imageContent.open);
                imageContent.node.addEventListener('pointerout', imageContent.lose);
                window.addEventListener('contextmenu', (event) => {
                    event.preventDefault();
                });
            }
            content.push(imageContent);
            break;
        case 'audio':
            const audioContent = new AudioComponent(bootloader, id, db.resources + element.MULTIMEDIA, false);
            audioContent.playButton.addEventListener('click', (e) => {
                bootloader.allAudios.forEach(audio => {
                    if(audio !== audioContent) audio.stopAudio();
                });
            });
            audioContent.node.style.setProperty('z-index', 1);
            content.push(audioContent);
            bootloader.allAudios.push(audioContent);
            break;
    }
    if (!(element.MULTIMEDIA && element.MULTIMEDIA_SOLO) && element.RESPUESTA !== '') {
        const pText = document.createElement('p');
        pText.innerHTML = element.RESPUESTA;
        content.push(pText);
    }

    return content
}

const siguientePregunta = () => {
    window.addEventListener('outoftime', handleOutOfTime, { once: true });


    bootloader.tiempoPregunta = Math.round(db.tiempoPregunta);
    bootloader.allAudios = [];

    //crear columnas
    const questions = db.preguntas[db.preguntaActual].PREGUNTAS;
    const col1 = [];
    const col2 = [];

    for (let index = 0; index < questions.length; index++) {
        const [firstResponse, secondReponse] = questions[index].RESPUESTAS;
        const firstCell = new Cell(index, 0, getCellContent(firstResponse, index + '-0'));
        const secondCell = new Cell(index, 1, getCellContent(secondReponse, index + '-1'));
        col1.push(firstCell);
        col2.push(secondCell);
    }

    col1.forEach(card => {
        card.setTargets(col2);
    });

    col2.forEach(card => {
        card.setTargets(col1);
    });
    [bootloader.firstCol, bootloader.secondCol] = [shuffle(col1), shuffle(col2)];
    bootloader.cells = [bootloader.firstCol, bootloader.secondCol].flat();
    const domCols = document.getElementsByClassName('g__par__grd__col');
    [bootloader.firstCol, bootloader.secondCol].forEach((column, index) => {
        const docFragment = document.createDocumentFragment();
        column.forEach(cell => {
            docFragment.appendChild(cell.renderer.node);
        });

        domCols[index].appendChild(docFragment);

        column.forEach((cell, index) => {
            setTimeout(() => {
                cell.renderer.show();
            }, index * 100);
        });
    });

    bootloader.infoBank.getElementsByClassName('gColumInfoBnkScrnNbr')[0].innerHTML = db.preguntaActual + 1;
    bootloader.infoBank.getElementsByClassName('gColumInfoBnkPairNbrs')[0].innerHTML = questions.length;
    bootloader.infoBank.getElementsByClassName('gColumInfoBnkPairNbr')[0].innerHTML = 0;

    bootloader.handleKeys = (event) => {
        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowRight':
                event.preventDefault();
                // focusNext();
                break;
            case 'ArrowDown':
            case 'ArrowLeft':
                event.preventDefault();
                // focusPrev();
                break;
        }
    }
    window.addEventListener('keydown', bootloader.handleKeys);

    bootloader.maxCellPoints = Math.round((bootloader.config.pointsPerScreen / (2 * questions.length)) * 1000) / 1000;
    bootloader.extraPoints = bootloader.config.pointsPerScreen - (bootloader.maxCellPoints * bootloader.cells.length);
    if (db.preguntaActual === db.preguntas.length - 1 && db.data.r.filter(r => r.s === 0).length === 0) { //if no errors, final extra points must let you end with 100 points
        bootloader.extraPoints += (100 - bootloader.config.pointsPerScreen * db.preguntas.length);
    }
    bootloader.extraPoints = Math.round(bootloader.extraPoints * 1000) / 1000;
}

const gameOver = () => {
    db.vidas = 0; //this makes common show Game Over
    bootloader.reproduceAudio(bootloader.gameOver,0,0.5);
    bootloader.elements.question.classList.remove('act');
    document.body.classList.add("gmv");
    //destruir objetos
    db.data.m.s=0;
    bootloader.scene.launch('Comun', { game: 'relacionarColumnas', db: db});
}

const gameWin = () => {
    setTimeout(() => {
        bootloader.reproduceAudio(bootloader.gameWin,0,0.1);
        bootloader.elements.question.classList.remove('act');
        document.body.classList.add("gmv");
        //deshabilitar interaccion con elementos
        bootloader.finish = true;
        db.data.m.s=1
        bootloader.scene.launch('Comun', { game: 'relacionarColumnas', db: db});
    }, bootloader.config.gameEndDelay);
}

class BaseCard {
    constructor(pId, eId, content) {
        this.pId = pId;
        this.eId = eId;
        this.content = content;
        this.state = cellState.DEFAULT;
        this.pointsValue = 1;
    }
    
    setState = (state) => {
        this.state = state;
    }

    dropPointsValue = () => {
        this.pointsValue = (this.pointsValue == 0.25) ? 0 : this.pointsValue / 2;
    }

    handleWrong = () => {
        this.setState(cellState.DEFAULT);
        this.dropPointsValue();
        this.renderer.renderWrong();
    }

    handleCorrect = () => {
        this.setState(cellState.PAIRED);
        setTimeout(() => {
            handlePoints(this);
            this.renderer.renderCorrect();
        }, bootloader.config.feedbackDelay);
    }

    destroy = () => {
        this.renderer.node.remove();
    }
}

class Cell extends BaseCard {
    constructor(pId, eId, content) {
        super(pId, eId, content);
        this.renderer = new CellRender({cell: this, arrowPainter: bootloader.arrowPainter});
        this.targets = [];

        this.drawer = null;

        this._addListeners();
    }

    setTargets(targets) {
        this.targets = targets;
    }

    getRect = () => {
        const coords = this.getPosition();//.renderer.handler.getBoundingClientRect();
        this.drawer = bootloader.arrowPainter.createArrow(coords);
    }

    _addListeners() {
        this.renderer.handler.addEventListener('mousedown', this._startDrag);
        this.renderer.handler.addEventListener('touchstart', this._startDrag, { passive: false });
    }

    _isNearTarget({ x, y, targetRect }) {
        const { left, right, top, bottom } = targetRect;

        return x > left && x < right && y > top && y < bottom;
    }

    isHover({ x, y }) {
        if (this.state !== cellState.DEFAULT) {
            return false;
        }

        const rect = this.renderer.node.getBoundingClientRect();
        return this._isNearTarget({ x, y, targetRect: rect });
    }

    _startDrag = (event) => {
        bootloader.columContainer.classList.add('drg');
        if(this.state !== cellState.PAIRED) {
            bootloader.reproduceAudio(bootloader.moverLetra);
            this.renderer.select();
            this.drawer.start(event)
            this.addDraggingListeners();
        }
    }
    _endDrag = (event) => {
        bootloader.columContainer.classList.remove('drg');
        this.renderer.deselect();
        const coords = getCoords(event);

        this.removeDraggingListeners();

        const match = this.targets.find(t => t.isHover(coords));

        if (match?.pId === this.pId) {
            bootloader.arrowPainter.drawArrow({ origin: this.getPosition(), target: match.getPosition(), className: 'line-fll' }, event);
            this.drawer.reset();
        } else {
            this.drawer.reset({className: 'svg-shape--wrg', delay: bootloader.config.wrongDelay});
        }
        if(match) {
            if (match.content[0] instanceof AudioComponent) {
                bootloader.allAudios.forEach(audio => audio.stopAudio());
                if(db.sonidoActividad) {match.content[0].playAudio();}
            }
            bootloader.reproduceAudio(bootloader.checkPress);
            const pair = new Pair(this, match);
            pair.checkPair({ animation: true });            
        } else {
            bootloader.reproduceAudio(bootloader.moverLetra);
        }
    }

    _move = (event) => {
        if(bootloader.actCell !== null && bootloader.actCell !== this) {
            bootloader.actCell.renderer.deselect();
            bootloader.actCell = null;
        }
        const coords = getCoords(event);

        const match = this.targets.find(t => t.isHover(coords));

        if (match) {
            const position = match.getPosition()
            this.drawer.draw(position, event)
        } else {
            this.drawer.draw(coords, event)
        }

        event.preventDefault()
    }

    addDraggingListeners() {
        document.addEventListener('mousemove', this._move);
        document.addEventListener('touchmove', this._move, { passive: false });
        document.addEventListener('mouseup', this._endDrag);
        document.addEventListener('mouseleave', this._endDrag);
        document.addEventListener('touchend', this._endDrag);
    }

    removeDraggingListeners() {
        document.removeEventListener('mousemove', this._move);
        document.removeEventListener('touchmove', this._move, { passive: false });
        document.removeEventListener('mouseup', this._endDrag);
        document.removeEventListener('mouseleave', this._endDrag);
        document.removeEventListener('touchend', this._endDrag);
    }

    freeze() {
        this.removeDraggingListeners();
        this.drawer.freeze();
    }

    restart() {
        const originRect = this.renderer.handler.getBoundingClientRect();

        const originX = originRect.x + originRect.width / 2;
        const originY = originRect.y + originRect.height / 2;

        this.drawer.remove();
        this.drawer = bootloader.arrowPainter.createArrow({
            x: originX,
            y: originY
        });
    }

    getPosition() {
        const originRect = this.renderer.handler.getBoundingClientRect();

        const originX = originRect.x + originRect.width / 2;
        const originY = originRect.y + originRect.height / 2;

        return { x: originX, y: originY };
    }
}

class CellRender {
    constructor({cell}) {
        this.cell = cell;

        this.node = document.createElement('button');
        this.node.classList.add('g__par__grd__itm', 'js_cell');
        this.node.addEventListener('click', this.handleClick);
        this.node.style.setProperty("visibility", "hidden");

        this.handler = document.createElement('div');
        this.handler.classList.add('card__handler', 'js-card__handler');

        this.contentWp = document.createElement('div');
        this.contentWp.classList.add('g__par__grd__itm__bx');

        this.cell.content.forEach(element => {
            if (element instanceof AudioComponent || element instanceof ImageComponent) {
                this.contentWp.appendChild(element.node);
            } else {
                this.contentWp.appendChild(element);
                let tag = getTextTag(element.innerHTML);
                this.node.classList.add(tag);
            }
        });
        this.node.appendChild(this.contentWp);
        this.node.appendChild(this.handler);
        // this.handler.addEventListener('click', this.handleClick);
        if(this.cell.content.length === 2) {this.contentWp.classList.add('g__par__grd__itm__bx--txtmed');}

        this.node.addEventListener('pointerover', ()=>{bootloader.reproduceAudio(bootloader.mouseHover, 0, 0.3)});
        this.node.addEventListener('focus', ()=>{bootloader.reproduceAudio(bootloader.mouseHover, 0, 0.3)});
    }

    show() {
        this.cell.getRect();
        this.node.style.removeProperty("visibility");
    }

    handleClick = () => {
        if (this.cell.state === cellState.PAIRED) { 
            bootloader.reproduceAudio(bootloader.blank);
            return;
        }
        
        if(bootloader.actCell === null) {//no cell selected
            this.select();
            bootloader.actCell = this.cell;
            return;
        }
        //casos columnas
        if(bootloader.actCell.eId === this.cell.eId) {//same col
            bootloader.actCell.renderer.deselect();
            if(db.columnMode && bootloader.actCell.pId !== this.cell.pId) {
                this.select();
                bootloader.actCell = this.cell;
            } else {
                bootloader.actCell = null;
            }
        } else {
            // bootloader.actCell.renderer.deselect();
            bootloader.reproduceAudio(bootloader.checkPress);
            const pair = new Pair(bootloader.actCell, this.cell);
            pair.checkPair();
        }
    }

    select = () => {
        this.cell.setState(cellState.SELECTED);
        bootloader.reproduceAudio(bootloader.checkPress);
        this.node.classList.add('act');

        if (this.cell.content[0] instanceof AudioComponent) {
            bootloader.allAudios.forEach(audio => audio.stopAudio());
            if(db.sonidoActividad) {this.cell.content[0].playAudio();}
        }
    } 

    deselect = () => {
        this.cell.setState(cellState.DEFAULT);
        this.node.classList.remove('act');
    }

    renderWrong = () => {
        setTimeout(() => {
            bootloader.reproduceAudio(bootloader.letraError);
            this.node.classList.add('wrg');
            setTimeout(() => {
                this.node.classList.remove('wrg');
                setTimeout(() => {
                    this.node.classList.remove('act');
                }, 110);//espero la transicion de quitar el wrg
                this.cell.setState(cellState.DEFAULT);
                // this.cell.content.filter(cont => cont instanceof AudioComponent)[0]?.stopAudio();
            }, bootloader.config.wrongDelay);
        }, bootloader.config.feedbackDelay);
    }

    renderCorrect = () => {
        this.node.classList.add('wn');
        this.node.addEventListener('animationend', () => {
            this.node.classList.remove('wn');
            this.node.classList.add('fll');
            if(this.cell.content[0] instanceof AudioComponent) { this.cell.content[0].stopAudio(); }
        });
    }
}

class Card extends BaseCard {
    constructor(pId, eId, content) {
        super(pId, eId, content);
        this.renderer = new CardRender(this);
    }
}

class CardRender {
    constructor(card) {
        this.card = card;
        this.node = document.createElement('button');
        this.node.classList.add('g__par__grd__itm', 'js_card');
        this.node.addEventListener('click', this.handleClick);
        this.node.style.setProperty('aspect-ratio', '1/1');
        this.node.style.setProperty("visibility", "hidden");
        const cardHdn = document.createElement('div');
        cardHdn.classList.add('g__par__grd__itm__hdn');
        this.contentWp = document.createElement('span');
        this.contentWp.classList.add('g__par__grd__itm__bx');
        this.card.content.forEach(element => {
            if (element instanceof AudioComponent || element instanceof ImageComponent) {
                this.contentWp.appendChild(element.node);
            } else {
                this.contentWp.appendChild(element);
                let tag = getTextTag(element.innerHTML);
                this.node.classList.add(tag);
            }
        });
        cardHdn.appendChild(this.contentWp);
        this.node.appendChild(cardHdn);
        if(this.card.content.length === 2) {this.contentWp.classList.add('g__par__grd__itm__bx--txtmed');}
        this.node.addEventListener('pointerover', ()=>{bootloader.reproduceAudio(bootloader.mouseHover, 0, 0.3)});
        this.node.addEventListener('focus', ()=>{bootloader.reproduceAudio(bootloader.mouseHover, 0, 0.3)});
    }

    show() {
        this.node.style.removeProperty("visibility");
    }

    handleClick = () => {
        if (this.card.state === cellState.PAIRED) { 
            bootloader.reproduceAudio(bootloader.blank);
            return;
        }
        
        if(bootloader.actCell === null) {//no card selected
            this.select();
            bootloader.actCell = this.card;
            return;
        }
        //casos columnas
        if(bootloader.actCell === this.card) {//same col
            bootloader.actCell.renderer.deselect();
            bootloader.actCell = null;
        } else {
            bootloader.actCell.renderer.deselect();
            const pair = new Pair(bootloader.actCell, this.card);
            pair.checkPair();
        }
    }

    select = () => {
        this.card.setState(cellState.SELECTED);
        bootloader.reproduceAudio(bootloader.checkPress);
        this.node.classList.add('act');
    } 

    deselect = () => {
        this.card.setState(cellState.DEFAULT);
        this.node.classList.remove('act');
    }

    renderWrong = () => {
        setTimeout(() => {
            bootloader.reproduceAudio(bootloader.letraError);
            this.node.classList.add('wrg');
            setTimeout(() => {
                this.node.classList.remove('wrg');
                setTimeout(() => {
                    this.node.classList.remove('act');
                }, 110);//espero la transicion de quitar el wrg
                this.card.setState(cellState.DEFAULT);
                // this.card.content.filter(cont => cont instanceof AudioComponent)[0]?.stopAudio();
            }, bootloader.config.wrongDelay);
        }, bootloader.config.feedbackDelay);
    }

    renderCorrect = () => {
        this.node.classList.add('wn');
        this.node.addEventListener('animationend', () => {
            this.node.classList.remove('wn');
            this.node.classList.add('fll');
        });
    }
}

class ArrowPainter {
    constructor({ svg, gridElement, scrollElement, color = 'black', width = 4 }) {
        this.svg = svg;
        this.color = color;
        this.width = width;

        this.scrollElement = scrollElement;
        this.x = 0;
        this.y = 0;
        this.gridElement = gridElement;

        this.resize()

        this.isFirefox = bootloader?.sys.game.device.browser.firefox;

        const isToachDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
        this.bulletSize = isToachDevice ? BULLET_SIZE_TOUCH : BULLET_SIZE;
    }

    resize() {
        const { width, height, left, top } = this.gridElement.getBoundingClientRect();
        const { paddingTop } = window.getComputedStyle(this.scrollElement);
        const paddingTopValue = parseInt(paddingTop, 10);

        this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        this.svg.setAttribute('width', width);
        this.svg.setAttribute('height', height);
        this.svg.style.width = width;
        this.svg.style.height = height;
        this.svg.style.left = left;
        this.svg.style.top = paddingTopValue;

        this.x = left;
        this.y = top;
    }

    createArrow(origin) {
        let arrow = null;
        let bullet = null;
        let bulletStart = null;
        let autoScrollInterval = null;
        let pos = {
            left: 0,
            top: 0,
            x: 0,
            y: 0,
        }

        return {
            start: (event) => {
                const coords = getCoords(event);
                pos = {
                    left: this.scrollElement.scrollLeft,
                    top: this.scrollElement.scrollTop,
                    x: coords.x,
                    y: coords.y,
                }
            },
            draw: (target, event) => {
                if (!arrow) {
                    arrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    this.svg.appendChild(arrow);
                    arrow.setAttribute('x1', origin.x - (this.isFirefox? 0 : this.x));
                    arrow.setAttribute('y1', origin.y - this.y);
                    arrow.setAttribute('stroke', this.color);
                    arrow.setAttribute('stroke-linecap', 'round');
                    arrow.classList.add('svg-shape');
                }
                if (!bullet) {
                    bullet = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    this.svg.appendChild(bullet);
                    bullet.setAttribute('cx', origin.x - (this.isFirefox? 0 : this.x));
                    bullet.setAttribute('cy', origin.y - this.y);
                    bullet.setAttribute('r', this.bulletSize);
                    bullet.setAttribute('fill', this.color);
                    bullet.classList.add('svg-shape');
                }

                if (!bulletStart) {
                    bulletStart = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    this.svg.appendChild(bulletStart);
                    bulletStart.setAttribute('cx', origin.x - (this.isFirefox? 0 : this.x));
                    bulletStart.setAttribute('cy', origin.y - this.y);
                    bulletStart.setAttribute('r', this.bulletSize);
                    bulletStart.setAttribute('fill', this.color);
                    bulletStart.classList.add('svg-shape');
                }

                const coords = getCoords(event)
                const speed = getScrollSpeed({
                    scrollContainer: this.scrollElement,
                    position: coords.y,
                });

                window.clearInterval(autoScrollInterval);

                if (speed !== 0) {
                    autoScrollInterval = window.setInterval(() => {
                        this.scrollElement.scrollBy(0, speed);
                        const scrollPosition = this.scrollElement.scrollTop

                        arrow.setAttribute('y2', target.y - this.y + scrollPosition);
                        arrow.setAttribute('x2', target.x - (this.isFirefox? 0 : this.x));
                        arrow.setAttribute('stroke-width', this.width);

                        bullet.setAttribute('cy', target.y - this.y + scrollPosition);
                        bullet.setAttribute('cx', target.x - (this.isFirefox? 0 : this.x));
                    }, 1000 / 60);
                }

                const scrollPosition = this.scrollElement.scrollTop

                arrow.setAttribute('y2', target.y - this.y + scrollPosition);
                arrow.setAttribute('x2', target.x - (this.isFirefox? 0 : this.x));
                arrow.setAttribute('stroke-width', this.width);

                bullet.setAttribute('cy', target.y - this.y + scrollPosition);
                bullet.setAttribute('cx', target.x - (this.isFirefox? 0 : this.x));

            },
            reset: () => {
                bullet?.remove();
                bullet = null;
                window.clearInterval(autoScrollInterval)
                if(!arrow) { return; }
                const x1 = arrow.getAttribute('x1');
                const y1 = arrow.getAttribute('y1');
                const x2 = arrow.getAttribute('x2');
                const y2 = arrow.getAttribute('y2');

                const lineLength = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
                const animationDuration = lineLength / 2000;
                const easing = 'cubic-bezier(0.45, 0, 0.55, 1)';

                arrow.setAttribute('stroke-dasharray', lineLength);
                arrow.setAttribute('stroke-dashoffset', 0);
                arrow.style.setProperty("--dash-length", lineLength)
                arrow.style.animation = `dash-reverse ${animationDuration}s ${easing} forwards`;
                arrow.addEventListener('animationend', () => {
                    bulletStart.remove();
                    bulletStart = null;

                    arrow.remove()
                    arrow = null;
                }, { once: true });
            },
            remove: () => {
                arrow?.remove();
                bullet?.remove();
                bulletStart?.remove();

                bulletStart = null;
                bullet = null;
                arrow = null;
            },
            freeze: () => {
                window.clearInterval(autoScrollInterval);
            }
        };
    }

    drawArrow({ origin, target, animation = false, className = null}) {
        const originX = origin.x - (this.isFirefox? 0 : this.x);
        const originY = origin.y - this.y;

        const targetX = target.x - (this.isFirefox? 0 : this.x);
        const targetY = target.y - this.y;

        const scrollPosition = this.scrollElement.scrollTop;

        const shapes = [];

        const bulletStart = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bulletStart.setAttribute('cx', originX);
        bulletStart.setAttribute('cy', originY + scrollPosition);
        bulletStart.setAttribute('r', this.bulletSize);
        bulletStart.setAttribute('fill', this.color);
        bulletStart.classList.add('svg-shape');
        shapes.push(bulletStart);

        const svgLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        svgLine.setAttribute('x1', originX);
        svgLine.setAttribute('y1', originY + scrollPosition);
        svgLine.setAttribute('x2', targetX);
        svgLine.setAttribute('y2', targetY + scrollPosition);
        svgLine.setAttribute('stroke', this.color);
        svgLine.setAttribute('stroke-width', this.width);
        svgLine.setAttribute('stroke-linecap', 'round');
        svgLine.classList.add('svg-shape');
        svgLine.classList.add(className);
        shapes.push(svgLine);

        bulletStart.classList.add(className);

        if (animation) {
            const easing = 'cubic-bezier(0.45, 0, 0.55, 1)';
            const lineLength = Math.sqrt(Math.pow(targetX - originX, 2) + Math.pow(targetY - originY, 2));
            const animationDuration = lineLength / 1000;

            svgLine.setAttribute('stroke-dasharray', lineLength);
            svgLine.setAttribute('stroke-dashoffset', lineLength);
            svgLine.style.animation = `dash ${animationDuration}s ${easing} forwards`;

            svgLine.addEventListener('animationend', () => {
                const bulletEnd = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                bulletEnd.setAttribute('cx', targetX);
                bulletEnd.setAttribute('cy', targetY + scrollPosition);
                bulletEnd.setAttribute('r', this.bulletSize);
                bulletEnd.setAttribute('fill', this.color);
                bulletEnd.classList.add('svg-shape');
                bulletEnd.classList.add(className);
                this.svg.appendChild(bulletEnd);
                shapes.push(bulletEnd);
            })
        } else {
            const bulletEnd = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            bulletEnd.setAttribute('cx', targetX);
            bulletEnd.setAttribute('cy', targetY + scrollPosition);
            bulletEnd.setAttribute('r', this.bulletSize);
            bulletEnd.setAttribute('fill', this.color);

            bulletEnd.classList.add('svg-shape');
            bulletEnd.classList.add(className);
            shapes.push(bulletEnd);

            this.svg.appendChild(bulletEnd);
        }

        this.svg.appendChild(svgLine);
        this.svg.appendChild(bulletStart);

        return () => {
            shapes.forEach(shape => shape.remove());
        }
    }

    reset() {
        this.svg.innerHTML='';
        this.resize();
    }
}

class Pair {
    constructor(actCell, altCell) {
        this.actCell = actCell;
        this.altCell = altCell;
    }

    isCorrect = () => {
        return this.actCell.pId === this.altCell.pId;
    }

    handleWrong = (animation) => {
        if(!animation && db.columnMode) {
            bootloader.reproduceAudio(bootloader.moverLetra);
            // const removeArrow = bootloader.arrowPainter.drawArrow({ origin: this.actCell.getPosition(), target: this.altCell.getPosition(), animation: true, className: 'svg-shape--wrg' }) 
            // setTimeout(removeArrow, bootloader.config.wrongDelay + 100);
        };
        handleLifeLoss(this.altCell);
        this._logPair(0);
        this.actCell.handleWrong();
        this.altCell.handleWrong();
        bootloader.actCell = null; //reset selection
    }

    handleCorrect = (animation) => { //animation true when you already have animation and don't want to reanimate, false otherwise
        bootloader.reproduceAudio(bootloader.correctWord);
        let solved = bootloader.infoBank.getElementsByClassName('gColumInfoBnkPairNbr')[0];
        solved.innerHTML = Number(solved.innerHTML) + 1;
        if(!animation && db.columnMode) { 
            bootloader.reproduceAudio(bootloader.moverLetra);
            bootloader.arrowPainter.drawArrow({ origin: this.actCell.getPosition(), target: this.altCell.getPosition(), animation: true, className: 'line-fll' })
        };
        bootloader.matches.push(this);
        this._logPair(1);
        this.actCell.handleCorrect();
        this.altCell.handleCorrect();
        if (allPaired()) {
            setTimeout(() => {
                handleScreenEnd(false);
            }, bootloader.config.screenEndDelay);
        }
        bootloader.actCell = null;  //reset selection
    }

    checkPair = ({animation = false} = {}) => {
        this.isCorrect() ? this.handleCorrect(animation) : this.handleWrong(animation); //if correct, do handleCorrect, do handleWrong otherwise
    }

    _logPair = (correct) => {
        db.data.r.push({
            s: correct,
            i: db.preguntaActual + ':' + this.actCell.pId + ':' + this.actCell.eId,
            a: db.preguntaActual + ':' + this.altCell.pId + ':' + this.altCell.eId
        });
    }
}

const destroyItems = () => {
    bootloader.arrowPainter.reset();
    bootloader.cells.forEach(cell => cell.destroy());
    bootloader.cells = [];
    bootloader.allAudios = [];
}

const handleScreenEnd = (outOfTime) => {
    // bootloader.unsubscribe();
    window.removeEventListener('keydown', bootloader.handleKeys);
    bootloader.columGrid.classList.remove('load-completed');
    if (db.preguntaActual === db.preguntas.length - 1) {
        if(db.columnMode) { bootloader.cells.forEach(cell => cell.freeze()) }
        const screenNum = db.preguntas.length;
        const timed = db.tieneTiempoPregunta;
        const halfPoints = db.puntos >= 50;
        bootloader.allAudios.forEach(audio => audio.stopAudio());
        if(outOfTime && screenNum === 1) {
            gameOver();
            return;
        }
        if(timed && screenNum > 1 && !halfPoints) {
            gameOver();
            return;
        }
        gameWin();
    } else {
        destroyItems();
        db.preguntaActual++;
        siguientePregunta();
    }
}

const allPaired = () => {
    return bootloader.cells.filter(cell => cell.state !== cellState.PAIRED).length === 0;
}

const allPerfect = () => {
    return bootloader.cells.filter(cell => cell.pointsValue < 1).length === 0;
}

const handleLifeLoss = (cell) => {
    if (db.vidasInfinitas) { return; }
    db.vidas--;
    const cellCoord = cell?.renderer.node.getBoundingClientRect();
    const coord = cellCoord ? { x: cellCoord.x + cellCoord.width / 2, y: cellCoord.y + cellCoord.height / 2 } : bootloader.config.lifeCoord;
    setTimeout(() => {
        renderLifeLoss(coord);
    }, bootloader.config.lifeDelay);
    if (db.vidas <= 0) {
        bootloader.allAudios.forEach(audio => audio.stopAudio());
        setTimeout(() => { gameOver() }, bootloader.config.gameOverDelay);
    }
}

const renderLifeLoss = (coord) => {
    bootloader.reproduceAudio(bootloader.live, 0, 2);
    bootloader.elements.lives.innerHTML = db.vidas; //update lives counter

    //heart animation
    let feedbackVida = bootloader.add.dom(coord.x, coord.y).createFromCache('feedbackVida').setOrigin(0.5);
    feedbackVida.getChildByID('fdb__lv').classList.add('act');

    setTimeout(() => {
        feedbackVida.destroy();
    }, 3000);
}

const handleOutOfTime = () => {
    handleLifeLoss();
    if (db.vidas > 0) {
        setTimeout(() => {
            handleScreenEnd(true);
        }, bootloader.config.screenEndDelay);
    }
}

const handlePoints = (cell) => {
    let upPoints = bootloader.maxCellPoints * cell.pointsValue;
    db.puntos += upPoints;
    db.puntos = Math.round(db.puntos * 1000) / 1000;
    const cellCoord = cell.renderer.node.getBoundingClientRect();
    setTimeout(() => {
        renderPoints({ x: cellCoord.x + cellCoord.width / 2, y: cellCoord.y + cellCoord.height / 2 }, upPoints)
    }, bootloader.config.pointsDelay);
}

const renderPoints = (coord, upPoints) => {
    bootloader.reproduceAudio(bootloader.coin, 0, 2);
    bootloader.elements.points.innerHTML = db.puntos;

    //points animation
    var fbPA = bootloader.add.dom(coord.x, coord.y).createFromCache('feedbackPuntosArcade').setOrigin(0.5);
    fbPA.getChildByID('gFdbPtsUp').innerHTML = upPoints;

    //extra points
    if (allPaired() && allPerfect() && bootloader.extraPoints > 0) {
        db.puntos += bootloader.extraPoints;
        fbPA.getChildByID('gFdbPtsUpMin').innerHTML = bootloader.extraPoints;
    }

    if (db.puntos > 100) { db.puntos = 100; }

    fbPA.getChildByID('fdbPts').classList.add('fdb__pts--up');

    setTimeout(() => {
        fbPA.destroy();
    }, bootloader.config.destroyPointsDelay);
}

const getTextTag = (text) => {
    const long = text.length;

    if (long === 1) {
        return "g__par__grd__itm--xxs";
    } else if (long < 3) {
        return "g__par__grd__itm--xs";
    } else if (long < 9) {
        return "g__par__grd__itm--s";
    } else if (long < 21) {
        return "g__par__grd__itm--m";
    } else if (long < 51) {
        return "g__par__grd__itm--l";
    } else if (long < 100) {
        return "g__par__grd__itm--xl";
    } else if (long < 151) {
        return "g__par__grd__itm--xxl";
    } else {
        return "g__par__grd__itm--xxxl";
    }
}

window.bootloader = Bootloader;