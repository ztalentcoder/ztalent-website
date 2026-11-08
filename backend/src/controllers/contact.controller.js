import { validateContactMessage } from '../validators/contact-message.js';

export async function createContactMessage(request, response) {
  const data = validateContactMessage(request.body);

  await request.app.locals.prisma.contactMessage.create({
    data: {
      ...data,
      status: 'NEW',
    },
  });

  response.status(201).json({
    status: 'received',
    message: 'Thank you. We will get back to you soon.',
  });
}
