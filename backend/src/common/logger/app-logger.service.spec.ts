import { AppLogger } from './app-logger.service';

describe('AppLogger', () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;
  const originalLevel = process.env.LOG_LEVEL;
  const originalFile = process.env.LOG_TO_FILE;

  beforeEach(() => {
    process.env.LOG_TO_FILE = 'false'; // avoid disk writes in test
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.env.LOG_LEVEL = originalLevel;
    process.env.LOG_TO_FILE = originalFile;
  });

  it('emits LOW/MEDIUM to stdout', () => {
    const log = new AppLogger();
    log.low('hello', 'Test');
    log.medium('hi', 'Test');
    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    expect(String(stdoutSpy.mock.calls[0][0])).toMatch(/\[LOW\] \[Test\] hello/);
    expect(String(stdoutSpy.mock.calls[1][0])).toMatch(/\[MEDIUM\] \[Test\] hi/);
  });

  it('emits HIGH/FATAL to stderr', () => {
    const log = new AppLogger();
    log.high('risky', 'Auth');
    log.fatal('dead', 'Bootstrap');
    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(String(stderrSpy.mock.calls[0][0])).toMatch(/\[HIGH\] \[Auth\] risky/);
    expect(String(stderrSpy.mock.calls[1][0])).toMatch(/\[FATAL\] \[Bootstrap\] dead/);
  });

  it('honours LOG_LEVEL threshold', () => {
    process.env.LOG_LEVEL = 'HIGH';
    const log = new AppLogger();
    log.low('skip');
    log.medium('skip');
    log.high('emit');
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledTimes(1);
  });

  it('maps NestJS LoggerService methods to categories', () => {
    const log = new AppLogger();
    log.log('info', 'Ctx');       // → LOW
    log.warn('warn', 'Ctx');      // → MEDIUM
    log.error('bad', '', 'Ctx');  // → HIGH
    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
  });

  it('serializes meta safely', () => {
    const log = new AppLogger();
    log.medium('evt', 'Ctx', { userId: 'abc', extra: { n: 1 } });
    expect(String(stdoutSpy.mock.calls[0][0])).toContain('"userId":"abc"');
  });
});
