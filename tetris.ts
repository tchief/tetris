const EmptyCell = ' ';
const ShapeCell = 'X';
const BlockCell = 'O';
type Cell = typeof EmptyCell | typeof ShapeCell | typeof BlockCell;
type Field = Cell[][];
type Shape = Cell[][];
type Point = { x: number; y: number; }
type Move = 'a' | 'd' | 'w' | 's' | 'x';
type Status = 'playing' | 'won' | 'lost';

interface Game {
  status: Status;
  field: Field;
  active: Shape;
  origin: Point; // left bottom corner of outer rectangle for active shape
  queue: Shape[];
  defaultOrigin: Point;
}

type State = Pick<Game, 'field' | 'active' | 'origin'>;

const randomItem = <T,>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)];

const toCells = (shape: string) =>
  shape.split('\n').map(line => [...line].map(cell => cell as Cell));

const getSize = (shape: Cell[][]) =>
  ({ width: shape[0].length, height: shape.length });

const inArea = (area: Cell[][], point: Point) => {
  const { width, } = getSize(area);
  return point.x < width && point.y >= 0 && point.x >= 0;
}

const generateShapes = (shapes: Shape[], count: number): Shape[] => {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(randomItem(shapes));
  }
  return result;
}

const isBusyCell = (cell: Cell) => cell === ShapeCell || cell === BlockCell;

const isFree = (field: Field, shape: Shape, newOrigin: Point) => {
  if (!inArea(field, newOrigin)) return false;

  const { width, height } = getSize(shape);
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const point = { x: newOrigin.x + j, y: newOrigin.y + i }
      if (point.y < 0) return false;
      if (field[point.y] && field[point.y][point.x] === undefined) return false;
      if (isBusyCell(field[point.y]?.[point.x]) && shape[i][j] === ShapeCell) return false;
    }
  }

  return true;
}

const remove = (field: Field, shape: Shape, origin: Point) => {
  const { width, height } = getSize(shape);

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const point = { y: origin.y + i, x: origin.x + j }
      if (inArea(field, point) && field[point.y] !== undefined && shape[i][j] === ShapeCell) {
        field[point.y][point.x] = EmptyCell;
      }
    }
  }
}

const add = (field: Field, shape: Shape, newOrigin: Point) => {
  const { width, height } = getSize(shape);
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      if (shape[i][j] === ShapeCell) {
        const point = { y: newOrigin.y + i, x: newOrigin.x + j }
        if (field[point.y] !== undefined) field[point.y][point.x] = ShapeCell;
      }
    }
  }
}

const move = (state: State, newOrigin: Point, newShape?: Shape) => {
  remove(state.field, state.active, state.origin);

  if (!isFree(state.field, newShape ?? state.active, newOrigin)) {
    add(state.field, state.active, state.origin);
    return false;
  }

  if (newShape) state.active = newShape;
  state.origin = newOrigin;
  add(state.field, state.active, newOrigin);

  return true;
}

const rotate = (shape: Shape, direction: -1 | 1): Shape => {
  const newShape = Array(shape[0].length);
  for (let i = 0; i < shape[0].length; i++) {
    newShape[i] = [];
    for (let j = shape.length - 1; j >= 0; j--) {
      if (direction === -1) newShape[i].push(shape[j][i]);
      else newShape[i].unshift(shape[j][i]);
    }
  }
  return direction === -1 ? newShape : newShape.reverse();
}

const moveDown = (state: State) => move(state, { x: state.origin.x, y: state.origin.y - 1 });
const moveLeft = (state: State) => move(state, { x: state.origin.x - 1, y: state.origin.y });
const moveRight = (state: State) => move(state, { x: state.origin.x + 1, y: state.origin.y });
const rotateLeft = (state: State) => move(state, state.origin, rotate(state.active, -1));
const rotateRight = (state: State) => move(state, state.origin, rotate(state.active, 1));
const noop = (_state: State) => { };

const cleanFullRows = (game: Game) => {
  const { height } = getSize(game.field);
  for (let i = 0; i < height; i++) {
    if (game.field[i].every(c => c === ShapeCell)) {
      game.field.splice(i, 1);
      const emptyLine = Array(game.field[i].length).fill(EmptyCell);
      game.field.push(emptyLine)
      i--;
    }
  }
}

const addNextShape = (game: Game) => {
  if (!isFree(game.field, game.active, game.defaultOrigin)) {
    game.status = 'lost';
    return;
  }

  const shape = game.queue.shift();
  if (!shape) {
    game.status = 'won';
    return;
  }

  game.active = shape;
  add(game.field, shape, game.defaultOrigin);
  game.origin = game.defaultOrigin;
}

const tick = (game: Game) => {
  const completed = moveDown(game);
  if (!completed) {
    cleanFullRows(game);
    addNextShape(game);
  }
  return true;
}

const printGame = (game: Pick<Game, 'field'>) => {
  console.log('\n' + game.field.map(line => `|${line.join('')}|\n`).reverse().join(''))
}

const rect = (v: string, w: number, h: number) => `${v.repeat(w)}\n`.repeat(h).slice(0, -1);
const fieldWxH = (width: number, height: number) => rect(EmptyCell, width, height);
const squareSxS = (side: number) => rect(ShapeCell, side, side);
const rectWxH = (width: number, height: number) => rect(ShapeCell, width, height);
const lineLx1 = (length: number) => rectWxH(length, 1);
const horse = 'XXX\n  X';
const heart = ' X \nXXX\nX X';
const shapes = [...[1, 2, 3].map(squareSxS), lineLx1(4), horse, heart];

const hotkeys = {
  'a': moveLeft,
  'd': moveRight,
  'w': rotateLeft,
  's': rotateRight,
  'x': noop
}

const createRectGame = (width: number, height: number, queueCount: number, wall?: boolean) => {
  const field = toCells(fieldWxH(width, height));
  if (wall) field[Math.floor(width / 2)][Math.floor(height / 2)] = BlockCell;
  const defaultOrigin = { x: Math.floor(width / 2) - 1, y: height - 1 };
  const queue = generateShapes(shapes.map(toCells), queueCount);
  const game: Game = {
    field,
    queue,
    status: 'playing',
    active: queue[0],
    origin: defaultOrigin,
    defaultOrigin
  };
  addNextShape(game);
  return game;
}

const promptMove = () => {
  let move: Move | undefined;
  while (!move || !hotkeys[move]) {
    move = prompt("Press any of 'a', 'd', 'w', 's', 'x' to make a move.") as Move;
  }
  return move;
}

const run = () => {
  const game = createRectGame(10, 10, 20, true);

  printGame(game);
  while (!['won', 'lost'].includes(game.status)) {
    const move = promptMove();
    hotkeys[move](game);
    printGame(game);
    tick(game);
  }

  console.log(`You have ${game.status}!`);
}

run();
