
/*----------  Data Declarations  ----------*/

const registerTable = document.getElementById('register-table');
const mainMemTable = document.getElementById('main-mem-table');
const trapTable = document.getElementById('trap-table');

const programTitle = document.getElementById('program-title');

const codeInput = document.getElementById('code-input');

const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const stepBtn = document.getElementById('step-btn');
const saveBtn = document.getElementById('save-btn');
const cyclesContainer = document.getElementById('cycles-container');
const numCyclesInput = document.getElementById('num-cycles-input');
const loadDropdown = document.getElementById('load-dropdown');
const loadDropdownOptions = document.getElementById('load-dropdown-options');
const importLoadBtn = document.getElementById('import-btn');
const hiddenImportFileInput = document.getElementById('import-file-hidden');

const consoleIO = document.getElementById('console');
const clrConsoleBtn = document.getElementById('clear-console');



// options
var PREMADE_PROGRAMS;
async function loadPremadePrograms() {
    const response = await fetch('programs.json');
    PREMADE_PROGRAMS = await response.json();
}
loadPremadePrograms().then(updatePremadeProgramUi);

// setup
createUi();
updateUi();

function createUi() {
    // give the user something to look at
    createTables();

    programTitle.onfocus = programTitle.select;
    // code input
    Wom.addTabFunctionality(codeInput);
    Wom.addLineSelectFunctionality(codeInput);
    codeInput.onchange = () => {
        compiled = false;
        saved = false;
    }

    // console
    clrConsoleBtn.onclick = clearConsole;
    consoleIO.oninput = inputConsole;
    consoleIO.addEventListener('keydown', submitConsoleInputOnEnter);

    // button row
    playBtn.addEventListener("click", userPlay);
    pauseBtn.addEventListener("click", userPause);
    Wom.yinYang(playBtn, pauseBtn);

    stepBtn.onclick = userStep;
    stopBtn.onclick = userStop;
    saveBtn.onclick = userSave;
    cyclesContainer.onfocus = (e) => {
        e.stopPropagation();
        numCyclesInput.select();
    };
    importLoadBtn.onclick = userImport;
    hiddenImportFileInput.onchange = readFileImport;

    // shortcuts
    addShortcuts();

    printConsoleLogMessage();
}

function updateUi() {
    updateRegisterTable();
    updateMainMemoryTable();
    updateTrapTable();
}

function addShortcuts() {    
    document.addEventListener('keydown', (e) => {
        // doesn't matter if user is focused on input
        if (e.ctrlKey) {
            switch (e.key) {
                case 's':
                    userSave(e);
                    return;
                case 'o':
                    userLoad(e);
                    return;
                case 'ArrowRight':
                    userStep(e);
                    return;
                case 'Space':
                    userPlayPause(e);
                    break;
            }
        }
        if (Wom.isFocusedOnInput()) {
            return;
        }
        // if user is not focusing on input
        if (e.ctrlKey) {
            switch (e.key) {
                case 'c':
                    userStop(e);
                    return;
            }
        }
    })
}


/*----------  User Input Actions  ----------*/
function userLoad(e) {
    e.preventDefault();
    loadDropdown.focus();
}

function userSave(e) {
    e.preventDefault();
    var a = document.createElement("a");
    a.href = window.URL.createObjectURL(new Blob([codeInput.value], {type: "text/x-assembly"}));
    let title = programTitle.value;
    if (title.includes('.') && !StringReader.substringAfter(title, '.')) {
        title = StringReader.substringBefore(title, '.');
    }
    if (!title.includes('.')) {
        title += '.S';
    }
    a.download = title;
    a.click();
}

function userPlayPause(e) {
    e.preventDefault();
}

function userPlay() {
    compileAndRun();
}

function userPause() {

}

// E. stEp with an E.
function userStep(e) {
    e.preventDefault();
    singleStep();
}

// O. stOp with an O.
function userStop(e) {
    e.preventDefault();
    stopPipeline();
}

function userImport() {
    hiddenImportFileInput.click();
}

function readFileImport() {
    if (!this.files.length) {
        return;
    }
    const file = this.files[0];
    const fr=new FileReader();
    fr.onload = () => {
        setCodeInput(
            file.name,
            fr.result
        );
    }
    fr.readAsText(file);
}

/*----------  UI variables  ----------*/

function getCyclesPerRun() {
    return Number.parseInt(
        numCyclesInput.value
    );
}

/*----------  console IO  ----------*/

function inputConsole() {
    protectConsoleInputOverwrite();
    protectConsoleInputLength();
    consoleIO.setAttribute("last", consoleIO.value);
}

// stop user from entering a longer string than is available to be input by syscall unit
function protectConsoleInputLength() {
    const data = consoleIO.getAttribute("data");
    const syscallUnitInputQueueLen = 32;
    const maxChars = syscallUnitInputQueueLen * 4 - 1;
    if (consoleIO.value.length > data.length + maxChars) {
        consoleIO.value = consoleIO.value.substring(0, data.length + maxChars);
    }
}

// stop user from editing immaleable console text
function protectConsoleInputOverwrite() {
    const data = consoleIO.getAttribute("data");
    // has overwrite?
    if (consoleIO.value.includes(data)) {
        // no overwrite
        return;
    }
    // overwrite
    // rollback
    consoleIO.value = consoleIO.getAttribute("last");
    consoleIO.selectionStart = consoleIO.value.length;
    consoleIO.selectionEnd = consoleIO.value.length;
}

function submitConsoleInputOnEnter(e) {
    if (e.key === 'Enter') {
        submitConsoleInput();
        saveConsoleInput(consoleIO.value + '\n');
    }
}

function submitConsoleInput() {
    let input = consoleIO.value;
    input = input.replace(consoleIO.getAttribute("data"), "");
    submitInput(input);
    saveConsoleInput(consoleIO.value);
}

function saveConsoleInput(value) {
    consoleIO.setAttribute("data", value);
    consoleIO.setAttribute("last", value);
}

function clearConsole() {
    saveConsoleInput('');
    consoleIO.value = '';
}

function outputInt(int) {
    outputToConsole(
        LogicGate.signedBitstringToDecimal(int)
    );
}

function outputString(fourByteString) {
    const split = LogicGate.split(fourByteString, 8, 8, 8, 8);
    const NUL_CHAR = '\x00';
    let out = '';
    let exit;
    for (let i = 0; i < split.length && !exit; i++) {
        let asciiByte = LogicGate.toAscii(split[i]);
        if (asciiByte === NUL_CHAR) {
            exit = true;
        } else {
            out += asciiByte;
        }
    }
    outputToConsole(out);
}

function outputToConsole(output) {
    submitConsoleInput();
    consoleIO.setAttribute(
        "data",
        consoleIO.getAttribute("data") + output
    );
    consoleIO.value = consoleIO.getAttribute("data");
}

function uiInput(input) {
    input = input + '\n';
    consoleIO.setAttribute(
        "data",
        consoleIO.getAttribute("data") + input
    );
    consoleIO.value = consoleIO.getAttribute("data");
}

/*----------  Tables  ----------*/

function createTables() {
    createRegisterTable();
    createMainMemoryTable();
    createTrapTable();
}

function updateTableRow(identifier, data) {
    const dataEl = document.getElementById(`${identifier}-data`);
    dataEl.innerText = data;
}

function createTableRow(identifier, title, data) {
    const tr = Wom.create('tr', `${identifier}-row`);

    const titleEl = Wom.createTo(tr, 'td', `${identifier}-title`);
    titleEl.innerText = title;

    const dataEl = Wom.createTo(tr, 'td', `${identifier}-data`);
    dataEl.innerText = data;
    
    return tr;
}

function getTableTitle(identifier) {
    return document.getElementById(`${identifier}-title`);
}

/*----------  Registers  ----------*/


function updateRegisterTable() {
    mips.registers().forEach((register, index) => {
        const regName = registers[index];
        updateRegisterRow(register, regName)
    });
}

function updateRegisterRow(register, regName) {
    updateTableRow(regName, register);
}

function createRegisterTable() {
    mips.registers().forEach((register, index) => {
        const regName = registers[index];
        createRegisterRow(register, regName);
    });
}

function createRegisterRow(register, regName) {
    const title = '$' + regName;
    const data = register;
    const tr = createTableRow(regName, title, data);
    registerTable.append(
        tr
    );
    const titleEl = getTableTitle(regName);
    titleEl.style = 'font-size: 18px;';
    tr.append(titleEl);
}


/*----------  Main Memory  ----------*/

function createMainMemoryTable() {
    const stack = mips.stackAtPointer();
    const addr1 = stack.stackPointer;
    const addr2 = LogicGate.incrementer32(addr1);
    const addr3 = LogicGate.incrementer32(addr2);
    const addr4 = LogicGate.incrementer32(addr3);

    mainMemTable.append(
        createTableRow('data4', '$sp+3', stack.dataOut4)
    );
    mainMemTable.append(
        createTableRow('data3', '$sp+2', stack.dataOut3)
    );
    mainMemTable.append(
        createTableRow('data2', '$sp+1', stack.dataOut2)
    );
    mainMemTable.append(
        createTableRow('data1', '$sp+0', stack.dataOut1)
    );
}

function updateMainMemoryTable() {
    const stack = mips.stackAtPointer();
    const addr1 = stack.stackPointer;
    const addr2 = LogicGate.incrementer32(addr1);
    const addr3 = LogicGate.incrementer32(addr2);
    const addr4 = LogicGate.incrementer32(addr3);

    updateTableRow('data4', stack.dataOut4);
    updateTableRow('data3', stack.dataOut3);
    updateTableRow('data2', stack.dataOut2);
    updateTableRow('data1', stack.dataOut1);
}


/*----------  Trap  ----------*/

function createTrapTable() {
    const trap = mips.trap;
    trapTable.append(
        createTableRow('trap-trap', 'Trap', trap.trap)
    );
    trapTable.append(
        createTableRow('trap-exit', 'Exit', trap.exit)
    );
    trapTable.append(
        createTableRow('trap-sysin', 'Sysin', trap.sysin)
    );
    trapTable.append(
        createTableRow('trap-of', 'Overflow', trap.OvF)
    );
    trapTable.append(
        createTableRow('trap-pipeline-trap', 'Pipeline Trap', trap.pipelineTrap.q)
    );
}

function updateTrapTable() {
    const trap = mips.trap;
    updateTableRow('trap-trap', trap.trap);
    updateTableRow('trap-exit', trap.exit);
    updateTableRow('trap-sysin', trap.sysin);
    updateTableRow('trap-of', trap.OvF);
    updateTableRow('trap-pipeline-trap', trap.pipelineTrap.q);
}

// prompt user whether they want to continue
function promptContinue() {
    const popup = Wom.createPopup("Continue?");
    const yes = Wom.createTo(popup, 'button', 'continue-yes');
    const no = Wom.createTo(popup, 'button', 'continue-no');
    yes.innerText = 'Yes';
    no.innerText = 'No';

    yes.onclick = () => {
        closePopup();
        retreiveFreshCyclesAndRun();
    }

    no.onclick = closePopup;

    function closePopup() {
        popup.remove();
    }
}


/*----------  Premade Programs  ----------*/

function updatePremadeProgramUi() {
    PREMADE_PROGRAMS.forEach(program => {
        const btn = Wom.createTo(loadDropdownOptions, 'button', `load-${program.title}`);
        if (program.optionName) {
            btn.innerText = program.optionName;
        } else {
            btn.innerText = program.title;
        }
        btn.onclick = () => {
            setCodeInput(program.title, program.text, program.cycles);
        }
        if (program.isNewProgram) {
            btn.addEventListener("click", addHeaderToCodeInput);
        }
        loadDropdownOptions.append(btn);
    });
}

function setCodeInput(title, text, cycles=150) {
    programTitle.value = title;
    codeInput.value = text;
    codeInput.dispatchEvent(new Event('input'));
    numCyclesInput.value = cycles;
}

function addHeaderToCodeInput() {
    // ######################
    // # Program Name       #
    // # Created mm/dd/yyyy #
    // ######################
    const programName = programTitle.value;
    const date = new Date();
    // mm/dd/yyyy
    const mm = Wunctions.numberToStringOfLength(
        date.getMonth() + 1, // gives index of month (0 = january)
        2
    );
    const dd = Wunctions.numberToStringOfLength(
        date.getDate(), 
        2
    );
    const yyyy = date.getFullYear();
    const createdDate = `${mm}/${dd}/${yyyy}`;
    const createdDateText = `Created ${createdDate}`;
    const lineOpen = '# ';
    const lineClose = ' #';
    const longerLen = Math.max(programName.length, createdDateText.length);
    const length = lineOpen.length + longerLen + lineClose.length;
    const hashtagRow = StringReader.mult('#', length);
    const nameLine = lineOpen + StringReader.bufferAfter(programName, ' ', longerLen) + lineClose;
    const dateLine = lineOpen + StringReader.bufferAfter(createdDateText, ' ', longerLen) + lineClose;
    const header = 
        hashtagRow + '\n' +
        nameLine + '\n' +
        dateLine + '\n' +
        hashtagRow + '\n\n';
    codeInput.value = header + codeInput.value;
}

function printConsoleLogMessage() {
    console.log("%cDev tools suck. %cSnooping's easier on GitHub: %chttps://github.com/jamesweber7", 
        "color: #09f; font-size: 30px;", 
        "color: red; font-size: 30px;", 
        "font-size: 18px;"
    );
}