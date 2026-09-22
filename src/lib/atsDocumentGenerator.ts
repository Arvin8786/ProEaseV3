import { UserProfile } from '@/types';
import { cleanDocumentAsterisks } from './limits';

/**
 * Intelligent ATS Document Generator Engine
 * Guarantees that documents always generate successfully with high-impact,
 * ATS-compliant Markdown structure, even if external AI models hit rate limits or quotas.
 */

export function generateAtsResume(profile: UserProfile, futureJobTitle?: string): string {
  const name = profile.displayName || 'Career Candidate';
  const role = futureJobTitle || profile.experience?.[0]?.position || 'Experienced Professional';
  const contactParts: string[] = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (profile.address) contactParts.push(profile.address);
  if (profile.linkedin) contactParts.push(profile.linkedin);
  if (profile.website) contactParts.push(profile.website);

  const contactLine = contactParts.join(' | ');

  const summary = profile.professionalSummary || 
    `Results-driven ${role} with a proven record of excellence, strategic execution, and professional leadership. Recognized for delivering measurable outcomes, collaborating across cross-functional teams, and driving operational efficiency in fast-paced environments.`;

  let markdown = `# ${name.toUpperCase()}\n`;
  if (contactLine) markdown += `${contactLine}\n\n`;
  markdown += `## PROFESSIONAL SUMMARY\n${summary}\n\n`;

  // Core Competencies / Skills
  if (profile.skills && profile.skills.length > 0) {
    markdown += `## CORE COMPETENCIES & TECHNICAL SKILLS\n`;
    markdown += `${profile.skills.join(' • ')}\n\n`;
  }

  // Work Experience
  if (profile.experience && profile.experience.length > 0) {
    markdown += `## PROFESSIONAL EXPERIENCE\n\n`;
    profile.experience.forEach(exp => {
      const dates = `${exp.startDate || '2022'} - ${exp.isCurrent ? 'Present' : (exp.endDate || '2024')}`;
      markdown += `### ${exp.position || 'Professional'} | ${exp.company || 'Organization'}\n`;
      markdown += `*${dates}${exp.location ? ` | ${exp.location}` : ''}*\n\n`;

      if (exp.description) {
        // Split description by newlines or bullets
        const lines = exp.description.split('\n').map(l => l.trim()).filter(Boolean);
        lines.forEach(l => {
          const cleanLine = l.replace(/^[-*•]\s*/, '');
          markdown += `• ${cleanLine}\n`;
        });
      } else {
        markdown += `• Spearheaded key initiatives, resulting in enhanced team productivity and streamlined project deliveries.\n`;
        markdown += `• Partnered with cross-functional stakeholders to implement best practices and industry-standard workflows.\n`;
        markdown += `• Monitored performance metrics and delivered high-quality results consistently within target deadlines.\n`;
      }
      markdown += `\n`;
    });
  }

  // Education
  if (profile.education && profile.education.length > 0) {
    markdown += `## EDUCATION\n\n`;
    profile.education.forEach(edu => {
      const dates = `${edu.startDate || '2018'} - ${edu.isCurrent ? 'Present' : (edu.endDate || '2022')}`;
      markdown += `### ${edu.degree || 'Degree'} in ${edu.field || 'Field of Study'}\n`;
      markdown += `${edu.school || 'University'} | *${dates}*\n\n`;
    });
  }

  // Certifications
  if (profile.certifications && profile.certifications.length > 0) {
    markdown += `## CERTIFICATIONS & LICENSES\n\n`;
    profile.certifications.forEach(cert => {
      markdown += `• **${cert.name}** – ${cert.issuer}${cert.date ? ` (${cert.date})` : ''}\n`;
    });
    markdown += `\n`;
  }

  // Languages
  if (profile.languages && profile.languages.length > 0) {
    markdown += `## LANGUAGES\n\n`;
    const langStr = profile.languages.map(l => `${l.name} (${l.proficiency})`).join(' • ');
    markdown += `${langStr}\n\n`;
  }

  // References
  const visibleRefs = (profile.references || []).filter(r => r.isVisible !== false);
  markdown += `## REFERENCES\n\n`;
  if (visibleRefs.length > 0) {
    visibleRefs.forEach(r => {
      markdown += `• **${r.name}**, ${r.position} at ${r.company}${r.email ? ` | ${r.email}` : ''}${r.phone ? ` | ${r.phone}` : ''}\n`;
    });
  } else {
    markdown += `References are available upon Request.\n`;
  }

  return cleanDocumentAsterisks(markdown);
}

export function generateAtsTailoredResume(
  profile: UserProfile, 
  targetJobTitle: string, 
  targetCompany?: string, 
  jobDescription?: string
): string {
  const name = profile.displayName || 'Career Candidate';
  const contactParts: string[] = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (profile.address) contactParts.push(profile.address);
  if (profile.linkedin) contactParts.push(profile.linkedin);
  if (profile.website) contactParts.push(profile.website);

  const contactLine = contactParts.join(' | ');

  const companyTarget = targetCompany ? ` at ${targetCompany}` : '';
  const summary = `Accomplished and results-driven professional dedicated to excelling as ${targetJobTitle}${companyTarget}. Leverages a comprehensive background in project execution, collaborative teamwork, and operational excellence to drive high-impact results aligned with organizational strategic priorities.`;

  let markdown = `# ${name.toUpperCase()}\n`;
  markdown += `### TARGET POSITION: ${targetJobTitle.toUpperCase()}${targetCompany ? ` — ${targetCompany.toUpperCase()}` : ''}\n`;
  if (contactLine) markdown += `${contactLine}\n\n`;
  markdown += `## TARGETED EXECUTIVE SUMMARY\n${summary}\n\n`;

  // Tailored Competencies
  if (profile.skills && profile.skills.length > 0) {
    markdown += `## TARGET ALIGNED COMPETENCIES & EXPERTISE\n`;
    markdown += `${profile.skills.join(' • ')}\n\n`;
  }

  // Experience
  if (profile.experience && profile.experience.length > 0) {
    markdown += `## RELEVANT PROFESSIONAL EXPERIENCE\n\n`;
    profile.experience.forEach(exp => {
      const dates = `${exp.startDate || '2022'} - ${exp.isCurrent ? 'Present' : (exp.endDate || '2024')}`;
      markdown += `### ${exp.position || 'Professional'} | ${exp.company || 'Organization'}\n`;
      markdown += `*${dates}${exp.location ? ` | ${exp.location}` : ''}*\n\n`;

      if (exp.description) {
        const lines = exp.description.split('\n').map(l => l.trim()).filter(Boolean);
        lines.forEach(l => {
          const cleanLine = l.replace(/^[-*•]\s*/, '');
          markdown += `• ${cleanLine}\n`;
        });
      } else {
        markdown += `• Delivered mission-critical objectives, exceeding established KPIs and supporting organizational growth.\n`;
        markdown += `• Applied modern technical frameworks and analytical rigor to optimize operational throughput.\n`;
        markdown += `• Mentored junior staff and collaborated across business units to ensure prompt milestone completion.\n`;
      }
      markdown += `\n`;
    });
  }

  // Education
  if (profile.education && profile.education.length > 0) {
    markdown += `## EDUCATION\n\n`;
    profile.education.forEach(edu => {
      const dates = `${edu.startDate || '2018'} - ${edu.isCurrent ? 'Present' : (edu.endDate || '2022')}`;
      markdown += `### ${edu.degree || 'Degree'} in ${edu.field || 'Field of Study'}\n`;
      markdown += `${edu.school || 'University'} | *${dates}*\n\n`;
    });
  }

  // Certifications
  if (profile.certifications && profile.certifications.length > 0) {
    markdown += `## CERTIFICATIONS\n\n`;
    profile.certifications.forEach(cert => {
      markdown += `• **${cert.name}** – ${cert.issuer}${cert.date ? ` (${cert.date})` : ''}\n`;
    });
    markdown += `\n`;
  }

  // References
  const visibleRefs = (profile.references || []).filter(r => r.isVisible !== false);
  markdown += `## REFERENCES\n\n`;
  if (visibleRefs.length > 0) {
    visibleRefs.forEach(r => {
      markdown += `• **${r.name}**, ${r.position} at ${r.company}${r.email ? ` | ${r.email}` : ''}${r.phone ? ` | ${r.phone}` : ''}\n`;
    });
  } else {
    markdown += `References are available upon Request.\n`;
  }

  return cleanDocumentAsterisks(markdown);
}

export function generateAtsCoverLetter(profile: UserProfile, companyName: string, jobTitle: string): string {
  const name = profile.displayName || 'Candidate';
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const contactParts: string[] = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (profile.address) contactParts.push(profile.address);
  const contactLine = contactParts.join(' • ');

  const skillsList = profile.skills && profile.skills.length > 0 
    ? profile.skills.slice(0, 4).join(', ') 
    : 'strategic leadership, analytical problem-solving, and efficient delivery';

  const recentExp = profile.experience?.[0];
  const recentRoleDesc = recentExp 
    ? `In my recent role as ${recentExp.position} at ${recentExp.company}, I demonstrated consistent value by championing strategic initiatives and driving core projects to completion.` 
    : 'Throughout my career, I have continually delivered impactful results through disciplined execution and clear communication.';

  const markdown = `**${name}**
${contactLine ? `${contactLine}\n` : ''}
${today}

Hiring Team & Talent Acquisition
**${companyName}**

**RE: Application for ${jobTitle} Position**

Dear Hiring Manager,

I am writing to express my enthusiastic interest in the ${jobTitle} role at ${companyName}. Having followed your organization's impressive accomplishments and industry reputation, I am confident that my background, domain capabilities, and dedicated work ethic make me a strong match for your team.

${recentRoleDesc} With strong capabilities in ${skillsList}, I am well-prepared to step into this position and make an immediate, positive contribution to ${companyName}'s current and future objectives.

What excites me most about this opportunity is ${companyName}'s commitment to quality and forward-thinking standards. I thrive in dynamic, high-accountability environments where collaboration, critical thinking, and disciplined delivery are prioritized.

Thank you for your time, consideration, and review of my application. I welcome the opportunity to discuss how my experience and skill set align with the needs of your team.

Sincerely,

**${name}**`;

  return cleanDocumentAsterisks(markdown);
}

export function generateAtsResignationLetter(
  profile: UserProfile, 
  companyName: string, 
  noticePeriod: string = '1 month', 
  reason?: string
): string {
  const name = profile.displayName || 'Employee';
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const contactParts: string[] = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  const contactLine = contactParts.join(' • ');

  const reasonSentence = reason && reason.trim()
    ? `This decision is made in light of ${reason.trim()}.`
    : `This decision has been made after careful consideration as I pursue the next stage of my professional journey.`;

  const markdown = `**${name}**
${contactLine ? `${contactLine}\n` : ''}
${today}

Management & Human Resources
**${companyName}**

**RE: Formal Resignation — Notice of Departure**

Dear Management Team,

Please accept this letter as formal notification that I am resigning from my position at ${companyName}. In accordance with my notice period of ${noticePeriod}, my final day of employment will be effective following the completion of this timeframe.

${reasonSentence}

I want to extend my sincere gratitude to ${companyName} and my colleagues for the support, guidance, and valuable experiences I have enjoyed during my tenure. I have deeply appreciated the professional growth and collaborative environment fostered here.

During my remaining time, I am fully committed to ensuring a seamless, organized transition of my daily responsibilities, active projects, and documentation to my team members. Please let me know how I can best assist during this handover process.

I wish ${companyName} and the entire team continued success and prosperity in all future endeavors.

Sincerely,

**${name}**`;

  return cleanDocumentAsterisks(markdown);
}
