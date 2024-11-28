"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import "./../app/app.css";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { fetchAuthSession } from 'aws-amplify/auth';

Amplify.configure(outputs);

const client = generateClient<Schema>();

// Funktion zum Prüfen der Benutzergruppen
async function checkUserGroups() {
  try {
    const session = await fetchAuthSession();
    const groups = session.tokens?.accessToken?.payload['cognito:groups'] as string[] || [];
    const isAdmin = groups.includes('Admin');
    const isMember = groups.includes('Member');
    return { isAdmin, isMember };
  } catch (error) {
    console.error('Error checking user groups:', error);
    return { isAdmin: false, isMember: false };
  }
}

export default function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [organizations, setOrganizations] = useState<Array<Schema["Organization"]["type"]>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [members, setMembers] = useState<Array<Schema["OrganizationMember"]["type"]>>([]);

  const { user, signOut } = useAuthenticator();

  // Lade Organisationen, bei denen der User Mitglied ist
  useEffect(() => {
    if (!user?.signInDetails?.loginId) return;

    const loadUserOrganizations = async () => {
      try {
        const { data: memberships } = await client.models.OrganizationMember.list({
          filter: { email: { eq: user.signInDetails?.loginId ?? '' } }
        });

        // Lade die entsprechenden Organisationen einzeln
        const orgs = [];
        for (const membership of memberships) {
          if (membership.organizationID) {
            const { data: org } = await client.models.Organization.get({ id: membership.organizationID });
            if (org) orgs.push(org);
          }
        }

        setOrganizations(orgs);
        if (orgs.length > 0) {
          setSelectedOrgId(orgs[0].id);
        }
      } catch (error) {
        console.error("Error loading organizations:", error);
      }
    };

    loadUserOrganizations();
  }, [user?.signInDetails?.loginId]);

  // Lade Mitglieder der ausgewählten Organisation
  useEffect(() => {
    if (!selectedOrgId) return;

    const loadMembers = async () => {
      const { data } = await client.models.OrganizationMember.list({
        filter: { organizationID: { eq: selectedOrgId } }
      });
      setMembers(data);
    };

    loadMembers();
  }, [selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId) return;

    const sub = client.models.Todo.observeQuery({
      filter: {
        organizationID: {
          eq: selectedOrgId
        }
      }
    }).subscribe({
      next: ({ items }) => setTodos([...items]),
    });

    return () => sub.unsubscribe();
  }, [selectedOrgId]);

  function createTodo() {
    if (!selectedOrgId) {
      alert("Bitte wähle zuerst eine Organisation aus");
      return;
    }

    const content = window.prompt("Todo content");
    if (content) {
      client.models.Todo.create({
        content,
        isDone: false,
        organizationID: selectedOrgId
      });
    }
  }
    
  function deleteTodo(id: string) {
    client.models.Todo.delete({ id });
  }

  function toggleDone(id: string) {
    client.models.Todo.update({ 
      id, 
      isDone: !todos.find(todo => todo.id === id)?.isDone 
    });
  }

  async function createOrganization() {
    const name = window.prompt("Organization name");
    if (!name || !user?.userId) return;

    try {
      const { data: newOrg } = await client.models.Organization.create({
        name
      });

      if (newOrg) {
        await client.models.OrganizationMember.create({
          organizationID: newOrg.id,
          userID: user.userId,
          email: user.signInDetails?.loginId ?? '',
          status: "PENDING"
        });

        setOrganizations([...organizations, newOrg]);
        setSelectedOrgId(newOrg.id);
      }
    } catch (error) {
      console.error("Error creating organization:", error);
      alert("Failed to create organization");
    }
  }

  async function addMember() {
    if (!selectedOrgId) return;
    
    const userEmail = window.prompt("Enter user email to add:");
    if (!userEmail) return;

    try {
      const { data: existingMembers } = await client.models.OrganizationMember.list({
        filter: { 
          and: [
            { organizationID: { eq: selectedOrgId } },
            { email: { eq: userEmail } }
          ]
        }
      });

      if (existingMembers.length > 0) {
        alert("This user is already a member of the organization!");
        return;
      }

      await client.models.OrganizationMember.create({
        organizationID: selectedOrgId,
        userID: userEmail,
        email: userEmail,
        status: "PENDING"
      });

      alert(`Invitation sent to ${userEmail}`);

      const { data } = await client.models.OrganizationMember.list({
        filter: { organizationID: { eq: selectedOrgId } }
      });
      setMembers(data);
    } catch (error) {
      console.error("Error adding member:", error);
      alert("Failed to add member");
    }
  }

  async function removeMember(memberId: string) {
    if (window.confirm("Are you sure you want to remove this member?")) {
      try {
        await client.models.OrganizationMember.delete({ id: memberId });
        setMembers(members.filter(m => m.id !== memberId));
      } catch (error) {
        console.error("Error removing member:", error);
        alert("Failed to remove member");
      }
    }
  }

  async function deleteOrganization(id: string) {
    if (!window.confirm("Are you sure you want to delete this organization and all its todos?")) {
      return;
    }

    try {
      // Lösche zuerst alle Todos
      const { data: orgTodos } = await client.models.Todo.list({
        filter: { organizationID: { eq: id } }
      });
      
      for (const todo of orgTodos) {
        await client.models.Todo.delete({ id: todo.id });
      }

      // Lösche alle Mitgliedschaften
      const { data: orgMembers } = await client.models.OrganizationMember.list({
        filter: { organizationID: { eq: id } }
      });

      for (const member of orgMembers) {
        await client.models.OrganizationMember.delete({ id: member.id });
      }

      // Lösche die Organisation
      await client.models.Organization.delete({ id });
      
      setOrganizations(organizations.filter(org => org.id !== id));
      if (selectedOrgId === id) {
        setSelectedOrgId("");
      }
    } catch (error) {
      console.error("Error deleting organization:", error);
      alert("Failed to delete organization");
    }
  }

  return (
    <main>
      <h1>Hello {user?.signInDetails?.loginId}</h1>
      <h2>{organizations.find(org => org.id === selectedOrgId)?.name}'s Todos</h2>
      
      <div style={{ margin: '10px 0', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <select 
          value={selectedOrgId} 
          onChange={(e) => setSelectedOrgId(e.target.value)}
          style={{ padding: '5px', minWidth: '200px' }}
        >
          <option value="">Select Organization</option>
          {organizations.map(org => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <button onClick={createOrganization}>+ New Organization</button>
        {selectedOrgId && (
          <button 
            onClick={() => deleteOrganization(selectedOrgId)}
            style={{ backgroundColor: '#ff4444' }}
          >
            Delete Organization
          </button>
        )}
      </div>

      {selectedOrgId && (
        <div style={{ margin: '20px 0' }}>
          <h3>Organization Members</h3>
          <button onClick={addMember}>+ Add Member</button>
          <ul>
            {members.map((member) => (
              <li key={member.id}>
                {member.email} - {member.status}
                {member.userID !== user?.userId && (
                  <button onClick={() => removeMember(member.id)}>Remove</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedOrgId && (
        <>
          <button onClick={createTodo}>+ New Todo</button>
          <ul>
            {todos.map((todo) => (
              <li key={todo.id}>
                {todo.content} 
                <span>{todo.isDone ? "✅" : "❌"}</span> 
                <button onClick={() => toggleDone(todo.id)}>Done</button> 
                <button onClick={() => deleteTodo(todo.id)}>Delete</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {!selectedOrgId && (
        <p>Please create or select an organization to see todos</p>
      )}

      <button onClick={signOut}>Sign out</button>
    </main>
  );
}
