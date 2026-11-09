export const CV_CONTRACT = `Return one JSON object with exactly these six fields: company, title, summary, skills, experience, education.
company is the target employer. company, title, and summary are nonblank strings.
skills is an array of category objects; each category has a nonblank name and a nonempty array of nonblank skill strings.
experience is an array of objects with exactly title, company, and sentences. title and company are nonblank strings; sentences is an array of nonblank strings.
education is an array of objects with exactly degree, a nonblank string. Outer arrays may be empty.
Do not add candidate identity, contact information, dates, job URL, schema metadata, cover letters, or formatting fields to this JSON object.
Do not wrap the JSON in Markdown.`;
