import fs from 'node:fs';

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, got ${count}`);
  fs.writeFileSync(path, source.replace(from, to));
}

replaceOnce(
  'src/server/reflectionRoutes.ts',
  `    if (!student) {
      const allowed = noteReflectionCodeFailure(ip);
      return res.status(allowed ? 401 : 429).json({ success: false, error: allowed ? 'LEARNING_CODE_NOT_FOUND' : 'TOO_MANY_FAILED_CODE_ATTEMPTS' });
    }
    const deviceToken = await issueReflectionDevice({`,
  `    if (!student) {
      const allowed = noteReflectionCodeFailure(ip);
      return res.status(allowed ? 401 : 429).json({ success: false, error: allowed ? 'LEARNING_CODE_NOT_FOUND' : 'TOO_MANY_FAILED_CODE_ATTEMPTS' });
    }
    // Reflection peer/teacher views require an assigned class. Do not issue a token
    // that the bootstrap path will immediately reject as an incomplete identity.
    if (!student.classId) {
      return res.status(409).json({ success: false, error: 'REFLECTION_CLASS_NOT_ASSIGNED' });
    }
    const deviceToken = await issueReflectionDevice({`,
);

replaceOnce(
  'src/reflection/ReflectionApp.tsx',
  `    catch (e: any) {
      setError(e?.code === 'TOO_MANY_FAILED_CODE_ATTEMPTS'
        ? '入力の確認回数が多くなっています。少し時間をおいて先生に確認してください。'
        : '学習者IDを確認できませんでした。先生に確認してください。');
    }`,
  `    catch (e: any) {
      setError(e?.code === 'TOO_MANY_FAILED_CODE_ATTEMPTS'
        ? '入力の確認回数が多くなっています。少し時間をおいて先生に確認してください。'
        : e?.code === 'REFLECTION_CLASS_NOT_ASSIGNED'
          ? 'この学習者IDには学級が設定されていません。先生に確認してください。'
          : '学習者IDを確認できませんでした。先生に確認してください。');
    }`,
);

replaceOnce(
  'scripts/qa-reflection-module.ts',
  `requireText(routes, 'TOO_MANY_FAILED_CODE_ATTEMPTS', 'learning-code brute-force protection');

// Persistence:`,
  `requireText(routes, 'TOO_MANY_FAILED_CODE_ATTEMPTS', 'learning-code brute-force protection');
requireText(routes, 'REFLECTION_CLASS_NOT_ASSIGNED', 'class-assignment registration guard');
requireText(reflection, '学級が設定されていません', 'class-assignment pupil guidance');
forbidText(reflection, 'ReflectionTextarea', 'six-part textarea regression');
forbidText(reflection, 'meg-fields-stack', 'six-part textarea regression');

// Persistence:`,
);

console.log('Reflection class-assignment guard patch applied.');
