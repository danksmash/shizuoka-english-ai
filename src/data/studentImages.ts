import oliverImg from '../assets/images/oliver_uk.jpg';
import emmaImg from '../assets/images/emma_usa.jpg';
import liamImg from '../assets/images/liam_aus.jpg';
import chloeImg from '../assets/images/chloe_can.jpg';
import benceImg from '../assets/images/bence_hun.jpg';
import zofiaImg from '../assets/images/zofia_pol.jpg';
import rahulImg from '../assets/images/rahul_ban.jpg';
import linhImg from '../assets/images/linh_vie.jpg';
import aungImg from '../assets/images/aung_mya.jpg';
import spritePart1 from '../assets/images/personas20_final_01.b64.txt?raw';
import spritePart2 from '../assets/images/personas20_final_02.b64.txt?raw';
import spritePart3 from '../assets/images/personas20_final_03.b64.txt?raw';
import spritePart4 from '../assets/images/personas20_final_04.b64.txt?raw';
import spritePart5 from '../assets/images/personas20_final_05.b64.txt?raw';
import spritePart6 from '../assets/images/personas20_final_06.b64.txt?raw';

export const STUDENT_AVATAR_MAP: Record<string, string> = {
  oliver_uk: oliverImg,
  emma_usa: emmaImg,
  liam_aus: liamImg,
  liam_australia: liamImg,
  chloe_can: chloeImg,
  chloe_canada: chloeImg,
  bence_hun: benceImg,
  bence_hungary: benceImg,
  zofia_pol: zofiaImg,
  zofia_poland: zofiaImg,
  rahul_ban: rahulImg,
  rahul_bangladesh: rahulImg,
  linh_vie: linhImg,
  linh_vietnam: linhImg,
  aung_mya: aungImg,
  aung_myanmar: aungImg,
};

export interface StudentAvatarSprite {
  src: string;
  column: number;
  row: number;
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
}

const decodeBase64Part = (part: string): ArrayBuffer => {
  const binary = atob(part.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const PERSONAS20_SPRITE_SRC = URL.createObjectURL(new Blob(
  [spritePart1, spritePart2, spritePart3, spritePart4, spritePart5, spritePart6].map(decodeBase64Part),
  { type: 'image/webp' },
));

const sprite = (column: number, row: number): StudentAvatarSprite => ({
  src: PERSONAS20_SPRITE_SRC,
  column,
  row,
  columns: 5,
  rows: 4,
  tileWidth: 80,
  tileHeight: 100,
});

// Approved 20-person portrait sheet. The order exactly follows TARGET_20_AI_STUDENT_IDS.
export const STUDENT_AVATAR_SPRITE_MAP: Record<string, StudentAvatarSprite> = {
  emma_usa: sprite(0, 0),
  oliver_uk: sprite(1, 0),
  liam_australia: sprite(2, 0),
  liam_aus: sprite(2, 0),
  minji_korea: sprite(3, 0),
  pavel_belarus: sprite(4, 0),

  lukas_germany: sprite(0, 1),
  aina_malaysia: sprite(1, 1),
  dimas_indonesia: sprite(2, 1),
  bence_hungary: sprite(3, 1),
  bence_hun: sprite(3, 1),
  yuting_taiwan: sprite(4, 1),

  zofia_poland: sprite(0, 2),
  zofia_pol: sprite(0, 2),
  matas_lithuania: sprite(1, 2),
  ananya_india: sprite(2, 2),
  xinyi_china: sprite(3, 2),
  linh_vietnam: sprite(4, 2),
  linh_vie: sprite(4, 2),

  rahul_bangladesh: sprite(0, 3),
  rahul_ban: sprite(0, 3),
  nadeesha_srilanka: sprite(1, 3),
  suman_nepal: sprite(2, 3),
  amara_nigeria: sprite(3, 3),
  andrei_romania: sprite(4, 3),
};
