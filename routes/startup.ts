import { Elysia, t } from "elysia";
import { generateNameAndQuestion } from "../utils/openai";
import { generateFollowupQuestion } from "../utils/followup";
import { db } from "../utils/firebase";
import { v4 as uuidv4 } from 'uuid';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { StartupIdea } from "../types";
import { openai } from "../utils/openai"
import {GENERATE_RANDOM_IDEA} from "../utils/prompt";

export const startupPlugin = (app: Elysia) =>
  app
    .get('/startup/random_idea', async () => {
      return (await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: GENERATE_RANDOM_IDEA
          }
        ],
      })).choices[0].message.content ?? ""
    })
    .post("/startup/analyze", async ({ body }) => {
    try {
      const id = uuidv4();
      const { description } = body;

      if (!description) {
        throw new Error('Description is required');
      }

      let nameAndQuestion;
      try {
        nameAndQuestion = await generateNameAndQuestion(description);
      } catch (openaiError) {
        throw new Error(`OpenAI error: ${openaiError instanceof Error ? openaiError.message : 'Unknown error'}`);
      }

      const { name, question } = nameAndQuestion;
      
      const startupIdea = {
        id,
        description,
        name,
        followup_question: question,
        is_all_finished: false
      };

      try {
        const startupRef = doc(db, 'startup_ideas', id);
        await setDoc(startupRef, startupIdea);
        
        const startupDoc = await getDoc(startupRef);
        const fetchedData = { id: startupDoc.id, ...startupDoc.data() };

        return {
          status: 'success',
          data: fetchedData
        };
      } catch (error) {
        throw error;
      }
    } catch (error: unknown) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error in startup analysis'
      };
    }
  }, {
    body: t.Object({
      description: t.String()
    })
  })
  .post("/startup/followup", async ({ body }) => {
    try {
      const { id, answer } = body;

      // Query the startup idea
      const startupQuery = query(
        collection(db, 'startup_ideas'),
        where('id', '==', id)
      );
      
      const querySnapshot = await getDocs(startupQuery);
      
      if (querySnapshot.empty) {
        throw new Error('Startup idea not found');
      }

      const currentIdea = {
        id: querySnapshot.docs[0].id,
        ...querySnapshot.docs[0].data()
      } as StartupIdea;

      const { updatedDescription, nextQuestion } = await generateFollowupQuestion(
        currentIdea.description,
        currentIdea.followup_question,
        answer
      );

      // Update the document
      await updateDoc(doc(db, 'startup_ideas', querySnapshot.docs[0].id), {
        description: updatedDescription,
        followup_question: nextQuestion
      });

      return {
        status: 'success',
        newDescription: updatedDescription,
        newQuestion: nextQuestion
      };

    } catch (error: unknown) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error in followup'
      };
    }
  }, {
    body: t.Object({
      id: t.String(),
      answer: t.String()
    })
  });