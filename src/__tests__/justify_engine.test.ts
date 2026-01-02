import { justifyText } from '../services/justify_engine';

describe('justifyText', () => {
  it('should justify a single line of text', () => {
    const text = 'This is a test';
    const width = 16;
    const expected = ['This is a test  '];
    expect(justifyText(text, width)).toEqual(expected);
  });

  it('should justify multiple lines of text', () => {
    const text = 'This is a test of multiple lines.';
    const width = 10;
    const expected = [
      'This  is a',
      'test    of',
      'multiple  ',
      'lines.    ',
    ];
    expect(justifyText(text, width)).toEqual(expected);
  });

  it('should handle empty string', () => {
    const text = '';
    const width = 10;
    const expected: string[] = [];
    expect(justifyText(text, width)).toEqual(expected);
  });

  it('should handle words longer than width', () => {
    const text = 'Averylongwordhere';
    const width = 5;
    const expected = ['Averylongwordhere']; // Words are not broken
    expect(justifyText(text, width)).toEqual(expected);
  });

  it('should handle words equal to width', () => {
    const text = 'word';
    const width = 4;
    const expected = ['word'];
    expect(justifyText(text, width)).toEqual(expected);
  });

  it('should return an empty array for empty input text', () => {
    const text = '';
    const width = 80;
    const expected: string[] = [];
    expect(justifyText(text, width)).toEqual(expected);
  });

  it('should justify text with a single word on multiple lines if the word is too long', () => {
    const text = 'longword';
    const width = 3;
    const expected = ['longword']; // Word cannot be broken
    expect(justifyText(text, width)).toEqual(expected);
  });

  it('should distribute spaces evenly', () => {
    const text = 'hello world';
    const width = 15;
    const expected = ['hello     world'];
    expect(justifyText(text, width)).toEqual(expected);
  });

  it('should handle leading/trailing spaces in input', () => {
    const text = '   hello world   ';
    const width = 15;
    const expected = ['hello     world'];
    expect(justifyText(text, width)).toEqual(expected);
  });
});